import type { Scope } from "@/lib/products/products-logic";

/**
 * When a shared page (Requests / Products / Customers) is viewed in a module
 * context (`?m=…`), the scope(s) that context restricts it to. `null` = no
 * restriction (the module spans scopes, e.g. logistics/purchasing).
 *
 * This is what lets the XOONX module render the shared pages under its own
 * sidebar + scope, instead of falling back to the viewer's primary module.
 */
export function moduleContextScopes(moduleKey: string): Scope[] | null {
  switch (moduleKey) {
    case "order_requests":
      return ["EGV"];
    case "xoonx":
      return ["XOONX"];
    default:
      return null;
  }
}
