// Pure customer logic. No DB/IO.
import type { Level } from "@/lib/auth/access-logic";
import type { AccessLike, Scope } from "@/lib/products/products-logic";

export const CONTACT_CHANNELS = ["WHATSAPP", "PHONE", "DIRECT", "FACEBOOK", "INSTAGRAM"] as const;
export type ContactChannel = (typeof CONTACT_CHANNELS)[number];

// Customers live in EGV or XOONX (no PERSONAL). Same hard boundary as requests.
export const CUSTOMER_SCOPES: Scope[] = ["EGV", "XOONX"];

export function isContactChannel(v: unknown): v is ContactChannel {
  return typeof v === "string" && (CONTACT_CHANNELS as readonly string[]).includes(v);
}

export function validateCustomer(input: { name?: string }): Record<string, string> {
  const e: Record<string, string> = {};
  if (!input.name?.trim()) e.name = "Name is required.";
  return e;
}

/** Scopes a user may view/manage customers in (EGV via Sales, XOONX via xoonx). */
export function customerScopes(a: AccessLike, level: Level): Scope[] {
  if (a.isAdmin) return [...CUSTOMER_SCOPES];
  const ok = (m: string) => (level === "OPERATE" ? a.can(m, "operate") : a.canModule(m, level));
  const s = new Set<Scope>();
  if (ok("order_requests")) s.add("EGV");
  if (ok("xoonx")) s.add("XOONX");
  return CUSTOMER_SCOPES.filter((x) => s.has(x));
}

/** Which module's shell to show around the shared /customers page. */
export function primaryCustomerModule(a: AccessLike): string {
  return a.canModule("xoonx") && !a.canModule("order_requests") ? "xoonx" : "order_requests";
}

/** The module that owns a customer scope (for action guards + audit). */
export function moduleForCustomerScope(scope: string): string {
  return scope === "XOONX" ? "xoonx" : "order_requests";
}
