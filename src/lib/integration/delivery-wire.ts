import { isDeliverySlot, isPaymentMethod } from "@/lib/deliveries/deliveries-logic";

/**
 * Wire contracts for the inbound Deliveries channel (Veeey → YeldnIN), contract
 * v2 §2.1 (`delivery.created`) and §2.2 (`delivery.cancel`). Pure — no DB/IO —
 * so parsing/validation is unit-testable and byte-compatible with Veeey.
 *
 * GOLDEN RULE AT THE WIRE: deliveries exist only for the VEEEY line, so there is
 * no scope field on the wire and none is accepted — the handler stamps VEEEY.
 * The one cross-cutting axis is `storeKey` (veeey.net | veeey.com): both are
 * VEEEY, but order numbers are only unique WITHIN a store, so it's half of the
 * correlation key. An unknown store is rejected, not coerced.
 */

export const STORE_KEYS = ["veeey.net", "veeey.com"] as const;
export type StoreKey = (typeof STORE_KEYS)[number];
export function isStoreKey(v: unknown): v is StoreKey {
  return typeof v === "string" && (STORE_KEYS as readonly string[]).includes(v);
}

export type WireDeliveryLine = { sku: string | null; name: string; qty: number };

export interface WireDeliveryCreated {
  storeKey: StoreKey;
  orderNumber: string;
  placedAt: string | null;
  customerName: string;
  customerPhone: string | null;
  customerAltPhone: string | null;
  addressZone: string | null;
  addressSubArea: string | null;
  addressText: string;
  addressMapUrl: string | null;
  lines: WireDeliveryLine[];
  collectPiastres: number;
  paymentMethod: string; // COD | PREPAID
  promisedDate: string | null;
  promisedSlot: string | null;
  notes: string | null;
}

export interface WireDeliveryCancel {
  storeKey: StoreKey;
  orderNumber: string;
  reason: string | null;
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; code: string };

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
/** A non-negative integer amount of piastres. The wire field is `collectAmountEgp`
 *  but its unit is piastres (per §2.1); anything else is rejected, not rounded. */
const piastres = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null);

function parseLines(raw: unknown): WireDeliveryLine[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((l): WireDeliveryLine | null => {
      if (!l || typeof l !== "object") return null;
      const o = l as Record<string, unknown>;
      const name = str(o.name);
      if (!name) return null; // a line with no label is useless to a courier
      const qty = Math.max(1, Math.floor(Number(o.qty) || 0));
      return { sku: str(o.sku), name, qty };
    })
    .filter((l): l is WireDeliveryLine => l != null);
}

/**
 * Validate an inbound `delivery.created`. Required: a known store, an order
 * number, a customer name and an address to deliver to. Everything else is
 * optional with safe defaults (COD, 0 to collect). Returns a specific code on
 * failure so Veeey can tell "unknown store" from "no address".
 */
export function parseDeliveryCreated(input: unknown): ParseResult<WireDeliveryCreated> {
  if (!input || typeof input !== "object") return { ok: false, code: "validation_failed" };
  const p = input as Record<string, unknown>;

  if (!isStoreKey(p.storeKey)) return { ok: false, code: "unknown_store" };
  const orderNumber = str(p.orderNumber);
  if (!orderNumber) return { ok: false, code: "missing_order_number" };

  const cust = (p.customer && typeof p.customer === "object" ? p.customer : {}) as Record<string, unknown>;
  const customerName = str(cust.name);
  if (!customerName) return { ok: false, code: "missing_customer" };

  const addr = (p.address && typeof p.address === "object" ? p.address : {}) as Record<string, unknown>;
  const addressText = str(addr.text);
  if (!addressText) return { ok: false, code: "missing_address" };

  const collect = piastres(p.collectAmountEgp) ?? 0;
  const paymentMethod = isPaymentMethod(p.paymentMethod) ? p.paymentMethod : "COD";
  // A prepaid order collects nothing; an unqualified positive amount on a PREPAID
  // order is contradictory, so prepaid is pinned to 0 rather than trusted.
  const collectPiastres = paymentMethod === "PREPAID" ? 0 : collect;

  return {
    ok: true,
    value: {
      storeKey: p.storeKey,
      orderNumber,
      placedAt: str(p.placedAt),
      customerName,
      customerPhone: str(cust.phone),
      customerAltPhone: str(cust.altPhone),
      addressZone: str(addr.zone),
      addressSubArea: str(addr.subArea),
      addressText,
      addressMapUrl: str(addr.mapUrl),
      lines: parseLines(p.lines),
      collectPiastres,
      paymentMethod,
      promisedDate: str(p.promisedDate),
      promisedSlot: isDeliverySlot(p.promisedSlot) ? p.promisedSlot : null,
      notes: str(p.notes),
    },
  };
}

/** Validate an inbound `delivery.cancel`. Store + order number identify the
 *  delivery; the reason is informational. */
export function parseDeliveryCancel(input: unknown): ParseResult<WireDeliveryCancel> {
  if (!input || typeof input !== "object") return { ok: false, code: "validation_failed" };
  const p = input as Record<string, unknown>;
  if (!isStoreKey(p.storeKey)) return { ok: false, code: "unknown_store" };
  const orderNumber = str(p.orderNumber);
  if (!orderNumber) return { ok: false, code: "missing_order_number" };
  return { ok: true, value: { storeKey: p.storeKey, orderNumber, reason: str(p.reason) } };
}

// ── Outbound: delivery.tracking (YeldnIN → Veeey, §2.3) ─────────────────────

export interface WireDeliveryTracking {
  storeKey: string;
  orderNumber: string;
  deliveryUid: string;
  status: string;
  at: string; // ISO — when it HAPPENED, not when it was sent
  courierName: string | null;
  promisedDate: string | null; // YYYY-MM-DD
  promisedSlot: string | null;
  reason: string | null; // failures only
  collectedAmountEgp: number | null; // piastres; only on DELIVERED
  reviewFlag: boolean;
  note: string | null;
  photoUrl: string | null; // after §5 upload; null until then
}

/** The loaded delivery a tracking event is built from. Kept as a plain shape (not
 *  a Prisma type) so this stays pure and unit-testable. */
export interface TrackingSource {
  uid: string;
  storeKey: string;
  orderNumber: string;
  scope: string;
  status: string;
  failureReason: string | null;
  collectedPiastres: number | null;
  reviewFlag: boolean;
  courierNote: string | null;
  reviewNote: string | null;
  promisedDate: Date | null;
  promisedSlot: string | null;
  courierName: string | null;
  photoUrl: string | null;
}

/**
 * Build a `delivery.tracking` wire event. Pure. `at` is passed in (the moment the
 * change happened) rather than read from a clock, so the caller controls it and
 * the function stays testable.
 *
 * `reason` is emitted only for a FAILED attempt and `collectedAmountEgp` only on
 * DELIVERED — the same field discipline the courier UI enforces, so a stale
 * reason from a prior attempt never rides along on a later status.
 */
export function buildTrackingWire(d: TrackingSource, at: Date): WireDeliveryTracking {
  return {
    storeKey: d.storeKey,
    orderNumber: d.orderNumber,
    deliveryUid: d.uid,
    status: d.status,
    at: at.toISOString(),
    courierName: d.courierName,
    promisedDate: d.promisedDate ? d.promisedDate.toISOString().slice(0, 10) : null,
    promisedSlot: d.promisedSlot,
    reason: d.status === "FAILED" ? d.failureReason : null,
    collectedAmountEgp: d.status === "DELIVERED" ? d.collectedPiastres : null,
    reviewFlag: d.reviewFlag,
    // The courier's note wins over an Ops flag note — it's the closer account of
    // what happened at the door.
    note: d.courierNote ?? d.reviewNote ?? null,
    photoUrl: d.photoUrl,
  };
}
