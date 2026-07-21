/**
 * Customer wire contract v2 — shared with the NEW Veeey storefront (contract v2
 * §2, `/customers/upsert`). Registered customers only (Veeey filters out
 * guests). Keyed on **`veeeyCustomerId`** (a stable Veeey account id). YeldnIN
 * stamps scope VEEEY + the VEEEY contact channel; those aren't sent.
 *
 * Pure (no DB/IO), unit-testable.
 */

export type WireCustomer = {
  veeeyCustomerId: string; // required — correlation key
  name: string; // required
  email: string | null; // normalized (lowercase) — cross-store match key
  phone: string | null;
  archived: boolean; // true only when the Veeey account is deleted → soft-archive
};

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Validate + normalize an inbound wire customer. Null (→ `validation_failed`)
 *  when the id or name is missing. Email is lowercased so the two Veeey stores'
 *  copies of the same person reconcile to one customer here. */
export function parseWireCustomer(input: unknown): WireCustomer | null {
  if (!input || typeof input !== "object") return null;
  const p = input as Record<string, unknown>;
  const veeeyCustomerId = str(p.veeeyCustomerId);
  const name = str(p.name);
  if (!veeeyCustomerId || !name) return null;
  const email = str(p.email)?.toLowerCase() ?? null;
  return { veeeyCustomerId, name, email, phone: str(p.phone), archived: p.archived === true };
}
