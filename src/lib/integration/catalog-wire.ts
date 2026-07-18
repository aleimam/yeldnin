/**
 * Catalog wire contract shared with Veeey (catalog sync channel — Veeey is the
 * catalog MASTER, so YeldnIN only RECEIVES here; there is no outbound catalog
 * emission from this side). Products are keyed on **`wpId`** — the WordPress
 * product id, which is `Veeey.Product.legacyWpId`. YeldnIN's `Product.sku`
 * currently holds that same WP id as a string (e.g. "120057"); the first push
 * links it into the stable `Product.veeeyWpId` column, and thereafter matching is
 * by `veeeyWpId`.
 *
 * This shape is IDENTICAL to Veeey's `src/lib/integration/catalog-sync.ts`. Pure
 * (no DB/IO) so the mapping is unit-testable and stays byte-compatible with the
 * other side.
 */

export type WireProduct = {
  wpId: number; // required correlation key (parse guarantees an integer)
  sku: string | null; // Veeey's own SKU
  name: string;
  type: string; // Veeey ProductKind: SUPPLEMENT | DEVICE | INJECTION
  active: boolean; // Veeey status === "PUBLISHED"
};

/**
 * Validate + normalize an inbound wire product (from Veeey). Returns null when the
 * payload is malformed — no integer `wpId`, or no `name` — so the handler can reject
 * it rather than write garbage. `sku`/`type` are tolerated (null / empty string).
 */
export function parseProductWire(input: unknown): WireProduct | null {
  if (!input || typeof input !== "object") return null;
  const p = input as Record<string, unknown>;
  const wpId = typeof p.wpId === "number" && Number.isInteger(p.wpId) ? p.wpId : null;
  const name = typeof p.name === "string" && p.name.trim() ? p.name.trim() : null;
  if (wpId == null || !name) return null;
  const sku = typeof p.sku === "string" && p.sku.trim() ? p.sku.trim() : null;
  const type = typeof p.type === "string" && p.type.trim() ? p.type.trim() : "";
  return { wpId, sku, name, type, active: p.active === true };
}
