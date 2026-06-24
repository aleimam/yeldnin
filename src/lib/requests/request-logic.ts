// Pure request logic. No DB/IO. Unit-tested.
import type { Level } from "@/lib/auth/access-logic";
import { isScope, type Scope, SCOPES } from "@/lib/products/products-logic";
import type { AccessLike } from "@/lib/products/products-logic";

export const REQUEST_TYPES = ["SPECIAL_ORDER", "OUT_OF_STOCK", "RESTOCK", "OPTIONAL"] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];
export function isRequestType(v: unknown): v is RequestType {
  return typeof v === "string" && (REQUEST_TYPES as readonly string[]).includes(v);
}

// ── Approval gate (#13/#14) ─────────────────────────────────────────────────
// EGV requests must be approved by a MANAGE-level approver before their items
// are spawned into the purchasing pool. XOONX has no gate.
export const REQUEST_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export function isRequestStatus(v: unknown): v is RequestStatus {
  return typeof v === "string" && (REQUEST_STATUSES as readonly string[]).includes(v);
}

/** EGV goes through the approval gate; XOONX is created already-approved. */
export function usesApprovalGate(scope: string): boolean {
  return scope === "EGV";
}

/** A request's items exist only once it's APPROVED. */
export function hasSpawnedItems(status: string): boolean {
  return status === "APPROVED";
}

/**
 * The request's lines can still be edited only while none of its spawned items
 * have moved past the initial REQUESTED state — i.e. nothing has been purchased
 * or shipped yet. A request with no items (PENDING / REJECTED) is always
 * editable. `itemStatuses` = current status of each spawned item.
 */
export function requestLinesEditable(itemStatuses: string[]): boolean {
  return itemStatuses.every((s) => s === "REQUESTED");
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
  const ok = (m: string) => (level === "OPERATE" ? a.can(m, "operate") : a.canModule(m, level));
  const s = new Set<Scope>();
  if (ok("order_requests")) s.add("EGV");
  if (ok("xoonx")) s.add("XOONX");
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
  const lines = (input.lines ?? []).filter((l) => l.productId && Number.isInteger(l.count) && l.count >= 1);
  if (!lines.length) e.lines = "Add at least one product line.";
  return e;
}

/**
 * Suggested special-order deposit: a percentage of the order's total selling
 * value (Σ count × selling price), rounded to whole EGP. Lines without a
 * selling price contribute 0.
 */
export function expectedDeposit(pct: number, lines: { count: number; sellingPrice: number | null }[]): number {
  const total = lines.reduce((sum, l) => sum + (l.count || 0) * (l.sellingPrice ?? 0), 0);
  return Math.round((total * (pct || 0)) / 100);
}
