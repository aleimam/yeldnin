/**
 * Outbound Incoming-Shipments channel (YeldnIN → Veeey): `shipment.received`,
 * emitted when Ops mark a shipment **WEBSITE** ("In Website"). Veeey's Sales
 * then review the expiry dates against the photos and approve, which is what
 * actually creates sellable stock — this event only reports what arrived.
 *
 * PURE (no DB/IO) so the grouping is unit-testable.
 *
 * Units are tracked individually in YeldnIN and each carries its own expiry, so
 * this collapses them into countable groups. The grouping key is
 * (expiry, lotCode, unitCost, currency) — deliberately **lossless**: two units
 * that share an expiry but cost different amounts stay separate rather than
 * being averaged into a number neither of them is. Veeey merges these into its
 * own lots (keyed product × expiry) at approval, where the cost decision and the
 * FX conversion belong.
 */

export interface WireShipmentLot {
  /** YYYY-MM-DD; null = non-perishable (a device) or not entered. */
  expiryDate: string | null;
  lotCode: string | null;
  quantity: number;
  /** Raw supplier cost per unit, NOT converted — Veeey pins the FX rate at approval. */
  unitCost: number | null;
  /** null = EGP (YeldnIN's convention on Item.purchaseCurrency). */
  currency: string | null;
}

export interface WireShipmentLine {
  /** Canonical shared key with Veeey (contract v2). */
  sku: string | null;
  /** Fallback link when a legacy row has no SKU. */
  veeeyWpId: number | null;
  productName: string;
  lots: WireShipmentLot[];
}

export interface WireShipmentReceived {
  shipmentUid: string | null;
  shipmentId: number;
  receivedAt: string;
  lines: WireShipmentLine[];
  /** YeldnIN asset ids — Veeey fetches the bytes over the integration channel. */
  photoAssetIds: string[];
}

export interface ShipmentUnit {
  productId: number;
  sku: string | null;
  veeeyWpId: number | null;
  productName: string;
  expiryDate: Date | null;
  lotCode: string | null;
  purchasePrice: number | null;
  purchaseCurrency: string | null;
}

const day = (d: Date | null): string | null => {
  if (!d) return null;
  const t = d.getTime();
  return Number.isNaN(t) ? null : d.toISOString().slice(0, 10);
};

/**
 * Collapse individually-tracked units into product lines with counted lots.
 * Output is sorted (product name, then expiry, then lot) so the same shipment
 * always produces byte-identical payloads — a re-fire must look like a retry,
 * not a new fact.
 */
export function buildShipmentWire(
  shipment: { id: number; uid: string | null },
  units: ShipmentUnit[],
  photoAssetIds: string[],
  at: Date,
): WireShipmentReceived {
  const byProduct = new Map<number, { line: Omit<WireShipmentLine, 'lots'>; lots: Map<string, WireShipmentLot> }>();

  for (const u of units) {
    let p = byProduct.get(u.productId);
    if (!p) {
      p = {
        line: { sku: u.sku?.trim() || null, veeeyWpId: u.veeeyWpId ?? null, productName: u.productName },
        lots: new Map(),
      };
      byProduct.set(u.productId, p);
    }
    const expiry = day(u.expiryDate);
    const lotCode = u.lotCode?.trim() || null;
    const cost = typeof u.purchasePrice === 'number' && Number.isFinite(u.purchasePrice) ? u.purchasePrice : null;
    const currency = u.purchaseCurrency?.trim().toUpperCase() || null;
    const key = `${expiry ?? ''}|${lotCode ?? ''}|${cost ?? ''}|${currency ?? ''}`;
    const existing = p.lots.get(key);
    if (existing) existing.quantity += 1;
    else p.lots.set(key, { expiryDate: expiry, lotCode, quantity: 1, unitCost: cost, currency });
  }

  const lines: WireShipmentLine[] = [...byProduct.values()]
    .map((p) => ({
      ...p.line,
      lots: [...p.lots.values()].sort(
        (a, b) => (a.expiryDate ?? '').localeCompare(b.expiryDate ?? '') || (a.lotCode ?? '').localeCompare(b.lotCode ?? ''),
      ),
    }))
    .sort((a, b) => a.productName.localeCompare(b.productName));

  return {
    shipmentUid: shipment.uid,
    shipmentId: shipment.id,
    receivedAt: at.toISOString(),
    lines,
    photoAssetIds: [...photoAssetIds],
  };
}

/** Units with no expiry entered — Ops must not hand a shipment over half-filled. */
export function unitsMissingExpiry(units: ShipmentUnit[]): number {
  return units.filter((u) => !u.expiryDate).length;
}

// ─── Inbound: Veeey Sales' verdict on a stock-in (contract v2, review loop) ───

export const REVIEW_DECISIONS = ["APPROVED", "REJECTED"] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export interface WireShipmentReview {
  shipmentUid: string;
  decision: ReviewDecision;
  reason: string | null;
  reviewedAt: string;
}

/** Validate Sales' verdict. Rejects an unknown decision rather than treating it
 *  as an approval — the failure mode of guessing here is stock nobody signed off. */
export function parseShipmentReview(input: unknown): WireShipmentReview | null {
  if (!input || typeof input !== "object") return null;
  const p = input as Record<string, unknown>;
  const uid = typeof p.shipmentUid === "string" && p.shipmentUid.trim() ? p.shipmentUid.trim() : null;
  const decision = typeof p.decision === "string" ? p.decision.trim().toUpperCase() : "";
  if (!uid || !(REVIEW_DECISIONS as readonly string[]).includes(decision)) return null;
  const at = typeof p.reviewedAt === "string" && !Number.isNaN(Date.parse(p.reviewedAt)) ? p.reviewedAt : new Date().toISOString();
  const reason = typeof p.reason === "string" && p.reason.trim() ? p.reason.trim().slice(0, 500) : null;
  return { shipmentUid: uid, decision: decision as ReviewDecision, reason, reviewedAt: at };
}
