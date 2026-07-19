// Pure product-catalog logic. No DB/IO. Unit-tested.
import type { Level } from "@/lib/auth/access-logic";

export const SCOPES = ["VEEEY", "XOONX", "PERSONAL"] as const;
export type Scope = (typeof SCOPES)[number];

export const PRODUCT_TYPES = ["SUPPLEMENT", "DEVICE", "INJECTION", "HEAVY_SUPPLEMENT", "XOONX"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export function isScope(v: unknown): v is Scope {
  return typeof v === "string" && (SCOPES as readonly string[]).includes(v);
}
export function isProductType(v: unknown): v is ProductType {
  return typeof v === "string" && (PRODUCT_TYPES as readonly string[]).includes(v);
}

/** Minimal shape of the access object the pure logic needs. */
export interface AccessLike {
  isAdmin: boolean;
  canModule: (moduleKey: string, min?: Level) => boolean;
  can: (moduleKey: string, capability: string) => boolean;
}

/**
 * Scopes a user may see/manage at the given module level, per the blueprint:
 * - Purchasing → VEEEY + XOONX
 * - Sales (order_requests) → VEEEY
 * - XOONX → XOONX
 * - Admins → all (incl. PERSONAL)
 */
export function productScopes(a: AccessLike, level: Level): Scope[] {
  if (a.isAdmin) return [...SCOPES];
  // Acting (OPERATE) is governed by each module's `operate` capability; visibility
  // (VIEW) stays the plain module-open level.
  const ok = (m: string) => (level === "OPERATE" ? a.can(m, "operate") : a.canModule(m, level));
  const s = new Set<Scope>();
  if (ok("purchasing")) {
    s.add("VEEEY");
    s.add("XOONX");
  }
  if (ok("order_requests")) s.add("VEEEY");
  if (ok("xoonx")) s.add("XOONX");
  return SCOPES.filter((x) => s.has(x));
}

/** Which module's shell to show around the shared /products page.
 *  Purchasing is folded into Logistics, so purchasing-access users (and admins)
 *  render under the logistics shell where Products lives as a shortcut. */
export function primaryProductModule(a: AccessLike): string {
  if (a.canModule("purchasing")) return "logistics";
  if (a.canModule("order_requests")) return "order_requests";
  if (a.canModule("xoonx")) return "xoonx";
  return "logistics"; // admins (canModule true everywhere) land here too
}

/** Selling prices are a Sales/XOONX concern; logistics/purchasing don't see them. */
export function canSeeSellingPrice(a: AccessLike): boolean {
  return a.isAdmin || a.canModule("order_requests") || a.canModule("xoonx");
}

/**
 * Purchase (buy) prices. VEEEY Sales is the sell side and must never see the
 * supply-chain buy cost — the golden rule. Purchasing/Logistics are the buy-side
 * back office (cross-scope). XOONX sources and pays for its own items, so the
 * buy price is that operator's own cost basis (it drives the XOONX P&L) and
 * stays visible to them — within XOONX scope, which is all they can ever reach.
 */
export function canSeePurchasePrice(a: AccessLike): boolean {
  return a.isAdmin || a.canModule("purchasing") || a.canModule("logistics") || a.canModule("xoonx");
}

export function validateProduct(input: { name?: string; scope?: string; type?: string }): Record<string, string> {
  const e: Record<string, string> = {};
  if (!input.name?.trim()) e.name = "Name is required.";
  if (!isScope(input.scope ?? "")) e.scope = "A valid scope is required.";
  if (!isProductType(input.type ?? "")) e.type = "A valid product type is required.";
  return e;
}
