// Pure payload builders + recipient predicate for web-push notifications. Kept
// free of Prisma / I/O so they can be unit-tested; the service layer loads the
// users and sends.
import { isAdminTier, levelMeets, type Level, type Tier } from "@/lib/auth/access-logic";

export interface PushPayload {
  title: string;
  body: string;
  /** App-relative path the notification opens on click. */
  url: string;
  /** Collapses same-tag notifications so repeats don't stack. */
  tag?: string;
}

export function issueOpenedPayload(issue: { uid?: string | null; title: string }): PushPayload {
  const ref = issue.uid ? `${issue.uid} — ` : "";
  return {
    title: "New issue opened",
    body: `${ref}${issue.title}`,
    url: "/issues",
    tag: issue.uid ? `issue-${issue.uid}` : "issue",
  };
}

export function tripAwaitingApprovalPayload(tripId: number): PushPayload {
  return {
    title: "Trip awaiting approval",
    body: `Trip #${tripId} has all team reviews — ready to approve.`,
    url: `/trips/${tripId}`,
    tag: `trip-approve-${tripId}`,
  };
}

export function itemsFlaggedPayload(count: number, flag: string): PushPayload {
  const noun = count === 1 ? "item" : "items";
  return {
    title: "Items flagged",
    body: `${count} ${noun} flagged as ${flag}.`,
    url: "/history",
    tag: `flag-${flag}`,
  };
}

export function slaAlertPayload(args: { uid?: string | null; status: "RISK" | "DELAYED"; requestId: number }): PushPayload {
  const ref = args.uid ? `${args.uid} — ` : "";
  return {
    title: args.status === "DELAYED" ? "Special order delayed" : "Special order at risk",
    body:
      args.status === "DELAYED"
        ? `${ref}delivery is past its promised date.`
        : `${ref}delivery is approaching its promised date.`,
    url: `/requests/${args.requestId}`,
    tag: `sla-${args.requestId}`,
  };
}

/**
 * Default unit-status milestones that notify the order's creator. The admin
 * event→recipient matrix (#27) will later let admins override which statuses
 * notify whom; until then these are the sales-meaningful checkpoints.
 */
export const UNIT_NOTIFY_STATUSES = ["ORDERED", "SHIPPED", "OFFICE", "WEBSITE"];

/** "Your order moved to <status>" — sent to the order's creator. */
export function unitUpdatePayload(args: { uid?: string | null; statusLabel: string; requestId: number }): PushPayload {
  const ref = args.uid ? `${args.uid} — ` : "";
  return {
    title: "Order update",
    body: `${ref}now ${args.statusLabel}.`,
    url: `/requests/${args.requestId}`,
    tag: `unit-${args.requestId}-${args.statusLabel}`,
  };
}

/**
 * Should this user receive an alert scoped to `moduleKeys`? Admin tiers always
 * do; otherwise the user needs at least `min` (default OPERATE) on one of the
 * modules — i.e. an operator who can actually act on it, not a passive viewer.
 */
export function isModuleOperator(
  tier: Tier,
  perms: { moduleKey: string; level: Level }[],
  moduleKeys: string[],
  min: Level = "OPERATE",
): boolean {
  if (isAdminTier(tier)) return true;
  return perms.some((p) => moduleKeys.includes(p.moduleKey) && levelMeets(p.level, min));
}
