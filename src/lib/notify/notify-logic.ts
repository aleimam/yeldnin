// Pure payload builders + recipient predicate for web-push notifications. Kept
// free of Prisma / I/O so they can be unit-tested; the service layer loads the
// users and sends.
import { isAdminTier, levelMeets, type Level, type Tier } from "@/lib/auth/access-logic";
import type { TFunction } from "@/i18n";

export interface PushPayload {
  title: string;
  body: string;
  /** App-relative path the notification opens on click. */
  url: string;
  /** Collapses same-tag notifications so repeats don't stack. */
  tag?: string;
}

export function issueOpenedPayload(t: TFunction, issue: { uid?: string | null; title: string }): PushPayload {
  const ref = issue.uid ? `${issue.uid} — ` : "";
  return {
    title: t("notify.issue.title"),
    body: `${ref}${issue.title}`,
    url: "/issues",
    tag: issue.uid ? `issue-${issue.uid}` : "issue",
  };
}

export function tripAwaitingApprovalPayload(t: TFunction, tripId: number): PushPayload {
  return {
    title: t("notify.trip.title"),
    body: t("notify.trip.body", { id: tripId }),
    url: `/trips/${tripId}`,
    tag: `trip-approve-${tripId}`,
  };
}

export function itemsFlaggedPayload(t: TFunction, count: number, flag: string): PushPayload {
  return {
    title: t("notify.flagged.title"),
    body: t("notify.flagged.body", { count, flag }),
    url: "/history",
    tag: `flag-${flag}`,
  };
}

export function slaAlertPayload(t: TFunction, args: { uid?: string | null; status: "RISK" | "DELAYED"; requestId: number }): PushPayload {
  const ref = args.uid ? `${args.uid} — ` : "";
  const delayed = args.status === "DELAYED";
  return {
    title: delayed ? t("notify.sla.title.delayed") : t("notify.sla.title.risk"),
    body: delayed ? t("notify.sla.body.delayed", { ref }) : t("notify.sla.body.risk", { ref }),
    url: `/requests/${args.requestId}`,
    tag: `sla-${args.requestId}`,
  };
}

/**
 * Default unit-status milestones that notify the order's creator. The admin
 * event→recipient matrix (#27) lets admins override these per event.
 */
export const UNIT_NOTIFY_STATUSES = ["ORDERED", "SHIPPED", "OFFICE", "WEBSITE"];

/** "Your order moved to <status>" — sent to the order's creator. */
export function unitUpdatePayload(t: TFunction, args: { uid?: string | null; statusLabel: string; requestId: number }): PushPayload {
  const ref = args.uid ? `${args.uid} — ` : "";
  return {
    title: t("notify.unit.title"),
    body: t("notify.unit.body", { ref, status: args.statusLabel }),
    url: `/requests/${args.requestId}`,
    tag: `unit-${args.requestId}-${args.statusLabel}`,
  };
}

// ── Admin notification matrix (#27) ──────────────────────────────────────────

export interface NotifyRule {
  event: string;
  enabled: boolean;
  notifyAdmins: boolean;
  notifyOrderCreator: boolean;
  moduleKeys: string; // CSV
  statuses: string; // CSV (unit.milestone only)
}

/** Catalog of routable events + which optional controls each exposes in the matrix. */
export const NOTIFY_EVENTS = [
  { key: "unit.milestone", orderCreator: true, statuses: true },
  { key: "items.flagged", orderCreator: false, statuses: false },
  { key: "issue.opened", orderCreator: false, statuses: false },
  { key: "trip.approval", orderCreator: false, statuses: false },
  { key: "sla.alert", orderCreator: false, statuses: false },
] as const;
export type NotifyEventKey = (typeof NOTIFY_EVENTS)[number]["key"];

/**
 * Code-defined defaults; DB rows override per event. These mirror the pre-#27
 * hardcoded behavior so an unconfigured system keeps notifying exactly as before.
 */
export const DEFAULT_NOTIFY_RULES: Record<string, NotifyRule> = {
  "unit.milestone": { event: "unit.milestone", enabled: true, notifyAdmins: false, notifyOrderCreator: true, moduleKeys: "", statuses: UNIT_NOTIFY_STATUSES.join(",") },
  "items.flagged": { event: "items.flagged", enabled: true, notifyAdmins: false, notifyOrderCreator: false, moduleKeys: "purchasing,logistics,operations", statuses: "" },
  "issue.opened": { event: "issue.opened", enabled: true, notifyAdmins: false, notifyOrderCreator: false, moduleKeys: "issues", statuses: "" },
  "trip.approval": { event: "trip.approval", enabled: true, notifyAdmins: true, notifyOrderCreator: false, moduleKeys: "", statuses: "" },
  "sla.alert": { event: "sla.alert", enabled: true, notifyAdmins: false, notifyOrderCreator: false, moduleKeys: "", statuses: "" },
};

/** Parse a CSV config value into trimmed, non-empty tokens. */
export function splitCsv(csv: string | null | undefined): string[] {
  return (csv ?? "").split(",").map((s) => s.trim()).filter(Boolean);
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
