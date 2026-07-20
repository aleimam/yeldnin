// Pure issues/compensations logic. No DB/IO. Unit-tested.

import type { Scope, AccessLike } from "@/lib/products/products-logic";

/**
 * Which issues a user may see. The blueprint keeps issue visibility
 * domain-scoped and **bars Sales entirely**. Admins and the cross-scope
 * operational back office (logistics / operations / purchasing) see every issue,
 * including the unscoped supplier / trip / courier ones; a dedicated issue
 * handler (issues OPERATE, no line module) is cross-scope too. XOONX sees only
 * its own line's issues. Everyone else — notably Sales — is barred (null).
 */
export function issueVisibility(a: AccessLike): "all" | Scope[] | null {
  if (a.isAdmin) return "all";
  if (a.canModule("logistics") || a.canModule("operations") || a.canModule("purchasing")) return "all";
  if (a.canModule("xoonx")) return ["XOONX"]; // XOONX line — scoped (checked before the pure-handler case)
  if (a.canModule("issues", "OPERATE")) return "all";
  return null;
}

/** Whether one issue (by its nullable scope) is visible under `vis`. Unscoped
 *  issues (supplier/trip/courier) are back-office-only, so a scoped viewer never
 *  sees them. */
export function issueVisible(vis: "all" | Scope[] | null, scope: string | null): boolean {
  if (!vis) return false;
  if (vis === "all") return true;
  return scope != null && vis.includes(scope as Scope);
}

/**
 * The scope a NEW issue may carry, or null when the caller may not create it.
 *
 * Creation was previously unvalidated: a XOONX operator submitting the ordinary
 * form created an UNSCOPED back-office issue they then could not open (the
 * redirect 404s), and a crafted call could set `scope: "VEEEY"` outright. A
 * single-line viewer may therefore only create issues on their own line, and
 * defaults to it when the form omits one. PURE.
 */
export function newIssueScope(
  vis: "all" | Scope[] | null,
  submitted: string | null | undefined,
): { ok: true; scope: string | null } | { ok: false } {
  if (!vis) return { ok: false };
  if (vis === "all") return { ok: true, scope: submitted ?? null };
  // Scoped viewer: fall back to their own line when nothing was submitted.
  const scope = submitted ?? (vis.length === 1 ? vis[0] : null);
  return issueVisible(vis, scope) ? { ok: true, scope } : { ok: false };
}

export const ISSUE_STATUSES = ["OPEN", "SOLVED"] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const COMPENSATION_TYPES = ["PRODUCT", "MONEY"] as const;
export type CompensationType = (typeof COMPENSATION_TYPES)[number];

export function isCompensationType(v: unknown): v is CompensationType {
  return typeof v === "string" && (COMPENSATION_TYPES as readonly string[]).includes(v);
}

export function validateIssue(input: { title?: string }): Record<string, string> {
  const e: Record<string, string> = {};
  if (!input.title?.trim()) e.title = "A title is required.";
  return e;
}

export function validateCompensation(input: { type?: string; amountEgp?: number | null }): Record<string, string> {
  const e: Record<string, string> = {};
  if (!isCompensationType(input.type ?? "")) e.type = "Pick a compensation type.";
  else if (input.type === "MONEY" && !(typeof input.amountEgp === "number" && input.amountEgp > 0)) {
    e.amount = "Enter an amount greater than 0.";
  }
  return e;
}
