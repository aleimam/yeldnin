import { REQUEST_TYPES, REQUEST_STATUSES } from "@/lib/requests/request-logic";

/**
 * The Request wire contract shared with Veeey (Requests epic Phase D). One
 * request = a uid-keyed, multi-line purchasing request; `uid` (REQ<YY><MM><seq3>)
 * is the correlation key both sides upsert on. This shape is IDENTICAL to Veeey's
 * `src/lib/integration/request-sync.ts` — the only difference is the money unit at
 * the edges: Veeey stores piastres (BigInt) and divides by 100; **YeldnIN stores
 * EGP as Float**, which IS the wire unit, so the mapping is a straight pass-through.
 *
 * Pure (no DB/IO) so the mapping is unit-testable and stays byte-compatible with
 * the other side.
 */

export type WireRequestLine = {
  sku: string | null;
  productName: string;
  quantity: number;
  sellingPriceEgp: number | null;
  notes: string | null;
};

export type WireRequest = {
  uid: string;
  type: string; // SPECIAL_ORDER | OUT_OF_STOCK | RESTOCK | OPTIONAL
  status: string; // PENDING | APPROVED | REJECTED
  scope: string; // ON THE WIRE: "EGV" | "XOONX" (legacy contract v1 value — see shim below)
  notes: string | null;
  depositEgp: number | null;
  autoOptional: boolean;
  archived: boolean;
  customer: { name: string | null; phone: string | null; veeeyCustomerId: string | null } | null;
  veeeyOrderId: string | null;
  lines: WireRequestLine[];
  photoUrls: string[];
};

const egp = (n: number | null | undefined): number | null => (typeof n === "number" && Number.isFinite(n) ? n : null);

/**
 * Legacy wire-scope shim. The LIVE legacy channel (old storefront, contract v1)
 * speaks scope "EGV"; internally the scope was renamed to "VEEEY". Map at the
 * wire boundary in both directions so the other side never sees the rename.
 * Contract v2 (the new Veeey) uses "VEEEY" natively — this shim retires with
 * the legacy /catalog channel at cutover (see INTEGRATION_V2 §6).
 */
const LEGACY_WIRE_SCOPE = "EGV";
export const toWireScope = (scope: string): string => (scope === "VEEEY" ? LEGACY_WIRE_SCOPE : scope);
export const fromWireScope = (scope: string): string => (scope === LEGACY_WIRE_SCOPE ? "VEEEY" : scope);

/**
 * GOLDEN RULE AT THE WIRE: this channel carries exactly ONE business line.
 *
 * Veeey is the VEEEY storefront; XOONX and PERSONAL are YeldnIN-only and have no
 * representation over there. The scope field therefore has exactly two legal
 * values ("VEEEY", or its legacy alias "EGV") and one legal omission (absent →
 * VEEEY). Anything else is a payload trying to reach across the boundary, and is
 * rejected rather than normalized — silently coercing it to VEEEY would let the
 * other side steer which line a record lands on, which is the same hole viewed
 * from the opposite end.
 */
export function isVeeeyWireScope(wireScope: unknown): boolean {
  if (wireScope == null) return true; // absent → the handler defaults to VEEEY
  return typeof wireScope === "string" && fromWireScope(wireScope) === "VEEEY";
}

/**
 * A loaded (already-fetched) YeldnIN request → wire payload. Pure.
 *
 * `autoOptional` and `veeeyOrderId` have no YeldnIN column (they are Veeey-side
 * concepts), so they are emitted as `false` / `null`; likewise the customer's
 * `veeeyCustomerId` — YeldnIN's own customer id is a local Int that is meaningless
 * to Veeey, so the customer travels by name/phone only.
 */
export function requestToWire(r: {
  uid: string | null;
  type: string;
  status: string;
  scope: string;
  notes: string | null;
  deposit: number | null;
  archivedAt: Date | null;
  customer: { name: string; contactNumber: string | null } | null;
  lines: { count: number; sellingPrice: number | null; notes: string | null; sku: string | null; productName: string }[];
  photoUrls: string[];
}): WireRequest {
  return {
    uid: r.uid ?? "",
    type: r.type,
    status: r.status,
    scope: toWireScope(r.scope),
    notes: r.notes,
    depositEgp: egp(r.deposit),
    autoOptional: false,
    archived: r.archivedAt != null,
    customer: r.customer ? { name: r.customer.name || null, phone: r.customer.contactNumber, veeeyCustomerId: null } : null,
    veeeyOrderId: null,
    lines: r.lines.map((l) => ({
      sku: l.sku,
      productName: l.productName,
      quantity: l.count,
      sellingPriceEgp: egp(l.sellingPrice),
      notes: l.notes,
    })),
    photoUrls: r.photoUrls,
  };
}

const asType = (v: unknown) => (typeof v === "string" && (REQUEST_TYPES as readonly string[]).includes(v) ? v : null);
const asStatus = (v: unknown) => (typeof v === "string" && (REQUEST_STATUSES as readonly string[]).includes(v) ? v : null);

/**
 * Validate + normalize an inbound wire request (from Veeey). Returns null when the
 * payload is malformed — no uid, unknown type, or no line with a sku or product
 * name — so the handler can reject it rather than write garbage. An unknown status
 * defaults to PENDING (the safe, non-committing state).
 */
export function parseWireRequest(input: unknown): WireRequest | null {
  if (!input || typeof input !== "object") return null;
  const p = input as Record<string, unknown>;
  const uid = typeof p.uid === "string" && p.uid.trim() ? p.uid.trim() : null;
  const type = asType(p.type);
  const status = asStatus(p.status) ?? "PENDING";
  if (!uid || !type) return null;
  // Reject before any further work — an off-line payload is not a partially
  // usable request, it's one that should never have been sent.
  if (!isVeeeyWireScope(p.scope)) return null;
  const rawLines = Array.isArray(p.lines) ? p.lines : [];
  const lines: WireRequestLine[] = rawLines
    .map((l): WireRequestLine | null => {
      if (!l || typeof l !== "object") return null;
      const o = l as Record<string, unknown>;
      const quantity = Math.max(1, Math.floor(Number(o.quantity) || 0));
      const productName = typeof o.productName === "string" ? o.productName : "";
      const sku = typeof o.sku === "string" && o.sku.trim() ? o.sku.trim() : null;
      if (!sku && !productName) return null;
      const price = o.sellingPriceEgp;
      return {
        sku,
        productName,
        quantity,
        sellingPriceEgp: typeof price === "number" && Number.isFinite(price) && price >= 0 ? price : null,
        notes: typeof o.notes === "string" ? o.notes : null,
      };
    })
    .filter((l): l is WireRequestLine => l != null);
  if (!lines.length) return null;
  const cust = p.customer as Record<string, unknown> | null | undefined;
  const dep = p.depositEgp;
  return {
    uid,
    type,
    status,
    scope: "VEEEY", // guarded by isVeeeyWireScope above — the only value this channel can produce
    notes: typeof p.notes === "string" ? p.notes : null,
    depositEgp: typeof dep === "number" && Number.isFinite(dep) && dep >= 0 ? dep : null,
    autoOptional: p.autoOptional === true,
    archived: p.archived === true,
    customer:
      cust && typeof cust === "object"
        ? {
            name: typeof cust.name === "string" ? cust.name : null,
            phone: typeof cust.phone === "string" ? cust.phone : null,
            veeeyCustomerId: typeof cust.veeeyCustomerId === "string" ? cust.veeeyCustomerId : null,
          }
        : null,
    veeeyOrderId: typeof p.veeeyOrderId === "string" ? p.veeeyOrderId : null,
    lines,
    photoUrls: Array.isArray(p.photoUrls) ? p.photoUrls.filter((u): u is string => typeof u === "string") : [],
  };
}
