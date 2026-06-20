// Pure HR logic. No DB/IO. Unit-tested.

export const EMP_UID_PREFIX = "EMP";

export const EMPLOYEE_PHOTO_KINDS = ["ID_FRONT", "ID_BACK", "GRAD_CERT", "BIRTH_CERT", "OTHER"] as const;
export type EmployeePhotoKind = (typeof EMPLOYEE_PHOTO_KINDS)[number];
export function isEmployeePhotoKind(v: unknown): v is EmployeePhotoKind {
  return typeof v === "string" && (EMPLOYEE_PHOTO_KINDS as readonly string[]).includes(v);
}

export const EMPLOYEE_EVENT_TYPES = ["CREATED", "PROFILE_EDIT", "MANAGER_CHANGED", "NOTE"] as const;
export type EmployeeEventType = (typeof EMPLOYEE_EVENT_TYPES)[number];

/**
 * Would setting `employeeId`'s line manager to `newManagerId` create a loop?
 * Walks up the proposed manager's chain via `parentOf`. An employee can't manage
 * itself, and the proposed manager can't already report (directly or indirectly)
 * to the employee. `seen` guards against any pre-existing cycle in the data.
 */
export function wouldCreateCycle(
  employeeId: number,
  newManagerId: number,
  parentOf: (id: number) => number | null | undefined,
): boolean {
  if (newManagerId === employeeId) return true;
  const seen = new Set<number>();
  let cur: number | null | undefined = newManagerId;
  while (cur != null) {
    if (cur === employeeId) return true;
    if (seen.has(cur)) break;
    seen.add(cur);
    cur = parentOf(cur);
  }
  return false;
}

/** Validate the minimal new-employee inputs (name + email; rich fields optional). */
export function validateNewEmployee(input: { name?: string; email?: string }): Record<string, string> {
  const e: Record<string, string> = {};
  if (!input.name?.trim()) e.name = "err.nameRequired";
  if (!input.email?.trim()) e.email = "err.emailRequired";
  else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email.trim())) e.email = "err.emailInvalid";
  return e;
}
