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
// Resolution actions per pool (Task-2 lifecycle):
// - recover:        item found/returns to a normal status; pick a destination
//                   (original container / hub / trip / traveler holding); a linked
//                   Issue closes as RECOVERED.
// - rebuy:          buy a replacement — a NEW unit enters the purchase pool; the
//                   lost/damaged unit stays flagged and is closed separately.
// - compensate:     jump to the linked Issue to record a Compensation.
// - close:          settle the loss explicitly (COMPENSATED or NO_COMPENSATION);
//                   the item is terminal (stays flagged), the Issue is SOLVED.
// - convertLost/convertDamaged: an Errant item converts to a loss (carries its
//                   Issue forward) — Errant is never final.
// - assignTrip:     route a Delayed item to a specific trip.
export type ResolutionAction = "recover" | "rebuy" | "compensate" | "close" | "convertLost" | "convertDamaged" | "assignTrip";

export function resolutionActions(pool: string): ResolutionAction[] {
  switch (pool) {
    case "LOST":
    case "DAMAGED":
      return ["recover", "rebuy", "compensate", "close"];
    case "ERRANT":
      return ["recover", "convertLost", "convertDamaged"];
    case "DELAYED":
      return ["assignTrip", "recover"];
    default:
      return ["recover"];
  }
}

// Where a recovered item lands.
export const RECOVER_KINDS = ["ORIGINAL", "HUB", "TRIP", "TRAVELER"] as const;
export type RecoverKind = (typeof RECOVER_KINDS)[number];

// Explicit closure reasons for a settled loss.
export const CLOSE_OUTCOMES = ["COMPENSATED", "NO_COMPENSATION"] as const;
export type CloseOutcome = (typeof CLOSE_OUTCOMES)[number];

/** i18n key for a pool's display name. */
export function poolLabelKey(pool: string): string {
  return `exceptions.pool.${pool}`;
}
