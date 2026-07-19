// Pure history logic. No DB/IO. Unit-tested.
import { SCOPES, type Scope, type AccessLike } from "@/lib/products/products-logic";

/**
 * Scopes whose item movements a user may see in History — the golden rule
 * applies here too (the blueprint: "History is scope-filtered; Sales/XOONX never
 * get trips/transfers"). Admins see all (incl. PERSONAL). The physical-handling
 * back office — logistics / operations / purchasing — is cross-scope over the
 * operational lines (VEEEY + XOONX) since it moves every item. Sales sees only
 * VEEEY, XOONX only XOONX. A user with just the `history` module and no
 * scope-granting module sees nothing (empty set → the list/lookup return
 * nothing, and item detail 404s).
 */
export function historyScopes(a: AccessLike): Scope[] {
  if (a.isAdmin) return [...SCOPES];
  const s = new Set<Scope>();
  if (a.canModule("logistics") || a.canModule("operations") || a.canModule("purchasing")) {
    s.add("VEEEY");
    s.add("XOONX");
  }
  if (a.canModule("order_requests")) s.add("VEEEY");
  if (a.canModule("xoonx")) s.add("XOONX");
  return SCOPES.filter((x) => s.has(x));
}
