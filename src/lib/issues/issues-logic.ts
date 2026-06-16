// Pure issues/compensations logic. No DB/IO. Unit-tested.

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
