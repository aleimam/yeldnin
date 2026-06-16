// Pure 3-team trip-review logic. No DB/IO. Unit-tested.
import type { Level } from "@/lib/auth/access-logic";

export const REVIEW_TEAMS = ["PURCHASING", "LOGISTICS", "OPERATIONS"] as const;
export type ReviewTeam = (typeof REVIEW_TEAMS)[number];

export const MARK_STATUSES = ["OK", "ISSUE"] as const;
export type MarkStatus = (typeof MARK_STATUSES)[number];

/** Each review team maps to the module a user must OPERATE to set its mark. */
export const TEAM_MODULE: Record<ReviewTeam, string> = {
  PURCHASING: "purchasing",
  LOGISTICS: "logistics",
  OPERATIONS: "operations",
};

export function isReviewTeam(v: unknown): v is ReviewTeam {
  return typeof v === "string" && (REVIEW_TEAMS as readonly string[]).includes(v);
}
export function isMarkStatus(v: unknown): v is MarkStatus {
  return typeof v === "string" && (MARK_STATUSES as readonly string[]).includes(v);
}

export interface AccessLike {
  isAdmin: boolean;
  canModule: (moduleKey: string, min?: Level) => boolean;
}

/** Teams whose mark this user may set (modules they can OPERATE; admins → all). */
export function teamsUserCanMark(a: AccessLike): ReviewTeam[] {
  return REVIEW_TEAMS.filter((team) => a.isAdmin || a.canModule(TEAM_MODULE[team], "OPERATE"));
}

/** An ISSUE mark requires a note. */
export function validateMark(input: { status?: string; note?: string }): Record<string, string> {
  const e: Record<string, string> = {};
  if (!isMarkStatus(input.status ?? "")) e.status = "Pick OK or Issue.";
  else if (input.status === "ISSUE" && !input.note?.trim()) e.note = "Describe the issue.";
  return e;
}
