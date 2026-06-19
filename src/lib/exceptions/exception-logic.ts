// Pure exception-pool logic. No DB/IO. Unit-tested.
//
// The four shared exception buckets (Lost / Damaged / Errant / Delayed) are
// defined as the canonical ItemStatus-adjacent flags in workflow-logic. This
// module adds the behavior layer: which pools open an Issue, and which
// resolution actions each pool offers.
import { EXCEPTION_POOLS, type ExceptionPool } from "@/lib/workflow/workflow-logic";

export { EXCEPTION_POOLS };
export type { ExceptionPool };

export function isExceptionPool(v: unknown): v is ExceptionPool {
  return typeof v === "string" && (EXCEPTION_POOLS as readonly string[]).includes(v);
}

/** Pools that auto-open an Issue when an item is flagged into them (real
 *  problems needing tracking). Delayed is a traveler-inventory state, not a
 *  loss, so it opens no Issue. */
const ISSUE_POOLS = new Set<string>(["LOST", "DAMAGED", "ERRANT"]);
export function poolOpensIssue(pool: string): boolean {
  return ISSUE_POOLS.has(pool);
}

// Resolution actions a user can take on an item sitting in a pool:
// - clear:      "found" — un-flag, return to its source container; closes the
//               linked Issue as solved when no flagged siblings remain.
// - rebuy:      return the unit to the pending-purchase pool (REQUESTED) so a
//               replacement is bought; the loss Issue stays open.
// - move:       re-point the item to a chosen container (trip/hub).
// - assignTrip: route a Delayed item to a specific trip.
// - compensate: jump to the linked Issue to record a Compensation.
export type ResolutionAction = "clear" | "rebuy" | "move" | "assignTrip" | "compensate";

/** Resolution actions offered for items currently in a given pool. */
export function resolutionActions(pool: string): ResolutionAction[] {
  switch (pool) {
    case "LOST":
    case "DAMAGED":
      return ["rebuy", "compensate", "clear"];
    case "ERRANT":
      return ["move", "rebuy", "clear"];
    case "DELAYED":
      return ["assignTrip", "clear"];
    default:
      return ["clear"];
  }
}

/** Actions that require the user to pick a target container (a trip/hub). */
export function actionNeedsTarget(action: ResolutionAction): boolean {
  return action === "move" || action === "assignTrip";
}

/** i18n key for a pool's display name and for the "clear" action label
 *  (Found for loss pools, Clear for Delayed). */
export function poolLabelKey(pool: string): string {
  return `exceptions.pool.${pool}`;
}
export function clearLabelKey(pool: string): string {
  return poolOpensIssue(pool) ? "exceptions.action.found" : "exceptions.action.clear";
}
