/**
 * Product wire contract v2 — shared with the NEW Veeey storefront (contract v2
 * §1, `/products/upsert`). Veeey is the catalog master for the DISPLAY layer
 * only; the supply-chain layer (purchase price, supplier, origin, weight, …) is
 * YeldnIN-owned and never travels here. Keyed on **`sku`** (Veeey-canonical);
 * `legacyWpId` is a one-time adoption fallback for products still linked by the
 * old WordPress id (`Product.veeeyWpId`).
 *
 * Pure (no DB/IO) so the mapping is unit-testable and byte-compatible with the
 * other side. The legacy `catalog-wire.ts` (wpId-keyed) stays until cutover.
 */

// Base product types Veeey may send. "HEAVY_SUPPLEMENT" is deliberately NOT
// here — heavy is a YeldnIN-internal refinement Veeey knows nothing about.
export const VEEEY_BASE_TYPES = ["SUPPLEMENT", "DEVICE", "INJECTION"] as const;

export type WireProductV2 = {
  sku: string; // required — canonical shared key ("120057" / variation "120057-1")
  legacyWpId: number | null; // optional — old WP id, for one-time adoption only
  name: string; // required — unique in YeldnIN
  type: string; // base type (VEEEY_BASE_TYPES); parse guarantees a valid value
  size: string | null;
  grade: string | null;
  photoUrls: string[]; // absolute http(s) URLs, replace-all, capped at 6
  archived: boolean; // true only on a Veeey hard-delete → YeldnIN soft-archives
};

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/**
 * Validate + normalize an inbound wire product. Returns null (→ the route
 * rejects with `validation_failed`) when required fields are missing or `type`
 * isn't a known base type. Photo URLs are filtered to absolute http(s) and
 * capped at 6.
 */
export function parseProductWireV2(input: unknown): WireProductV2 | null {
  if (!input || typeof input !== "object") return null;
  const p = input as Record<string, unknown>;
  const sku = str(p.sku);
  const name = str(p.name);
  const type = str(p.type);
  if (!sku || !name || !type || !(VEEEY_BASE_TYPES as readonly string[]).includes(type)) return null;
  const photoUrls = Array.isArray(p.photoUrls)
    ? p.photoUrls.filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u.trim())).map((u) => u.trim()).slice(0, 6)
    : [];
  return {
    sku,
    legacyWpId: typeof p.legacyWpId === "number" && Number.isInteger(p.legacyWpId) ? p.legacyWpId : null,
    name,
    type,
    size: str(p.size),
    grade: str(p.grade),
    photoUrls,
    archived: p.archived === true,
  };
}

/**
 * The heavy-never-downgrade rule (contract v2 §1). Veeey owns the base type but
 * knows nothing about "heavy"; if YeldnIN already marked a product
 * HEAVY_SUPPLEMENT, an incoming SUPPLEMENT must NOT overwrite that refinement.
 * Any other incoming type replaces the local one.
 */
export function resolveSyncedType(incomingBase: string, existingType: string | null): string {
  if (existingType === "HEAVY_SUPPLEMENT" && incomingBase === "SUPPLEMENT") return "HEAVY_SUPPLEMENT";
  return incomingBase;
}
