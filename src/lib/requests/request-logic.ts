// Pure request logic. No DB/IO. Unit-tested.
import type { Level } from "@/lib/auth/access-logic";
import { isScope, type Scope, SCOPES } from "@/lib/products/products-logic";
import type { AccessLike } from "@/lib/products/products-logic";

export const REQUEST_TYPES = ["SPECIAL_ORDER", "OUT_OF_STOCK", "RESTOCK", "OPTIONAL"] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];
export function isRequestType(v: unknown): v is RequestType {
  return typeof v === "string" && (REQUEST_TYPES as readonly string[]).includes(v);
}

export function requiresCustomer(type: string): boolean {
  return type === "SPECIAL_ORDER";
}
export function allowsPhotos(type: string): boolean {
  return type === "SPECIAL_ORDER";
}

/**
 * Scopes a user may create/view requests in. Requests are placed by Sales
 * (EGV) and XOONX (XOONX); admins all. (Purchasing does NOT place requests.)
 */
export function requestScopes(a: AccessLike, level: Level): Scope[] {
  if (a.isAdmin) return [...SCOPES];
  const s = new Set<Scope>();
  if (a.canModule("order_requests", level)) s.add("EGV");
  if (a.canModule("xoonx", level)) s.add("XOONX");
  return SCOPES.filter((x) => s.has(x));
}

/** Which module's shell to show around the shared /requests page. */
export function primaryRequestModule(a: AccessLike): string {
  if (a.canModule("order_requests")) return "order_requests";
  if (a.canModule("xoonx")) return "xoonx";
  return "order_requests";
}

export interface RequestLineInput {
  productId: number;
  count: number;
}
export function validateRequest(input: {
  type?: string;
  scope?: string;
  customerId?: number | null;
  newCustomerName?: string;
  lines?: RequestLineInput[];
}): Record<string, string> {
  const e: Record<string, string> = {};
  if (!isRequestType(input.type ?? "")) e.type = "A valid request type is required.";
  if (!isScope(input.scope ?? "")) e.scope = "A valid scope is required.";
  if (requiresCustomer(input.type ?? "") && !input.customerId && !input.newCustomerName?.trim()) {
    e.customer = "A special order needs a customer.";
  }
  const lines = (input.lines ?? []).filter((l) => l.productId && l.count >= 1);
  if (!lines.length) e.lines = "Add at least one product line.";
  return e;
}
