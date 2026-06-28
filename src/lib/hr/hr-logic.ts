// Pure HR logic. No DB/IO. Unit-tested.

export const EMP_UID_PREFIX = "EMP"; // internal Employee record code (legacy)

// ── Employee number (the user-facing code on User.uid) ───────────────────────
// Format: "YE" + a number. Admins start at 1001 (band 1001–1100); regular staff
// start at 1101 (1101+). The next number is the highest in the band + 1; admins
// may also set a number manually (uniqueness enforced in the service).
export const EMP_NUMBER_PREFIX = "YE";
export const EMP_ADMIN_START = 1001;
export const EMP_STAFF_START = 1101; // = admin band ceiling + 1

const ADMIN_TIERS = ["SUPER_ADMIN", "ADMIN"];
export function isAdminTier(tier: string | null | undefined): boolean {
  return !!tier && ADMIN_TIERS.includes(tier);
}

/** A valid employee number is "YE" followed by digits. */
export function isValidEmployeeNumber(v: string | null | undefined): boolean {
  return typeof v === "string" && /^YE\d{3,}$/.test(v.trim());
}

/** Parse the numeric part of an employee number, or null if malformed. */
export function employeeNumberValue(v: string | null | undefined): number | null {
  const m = /^YE(\d{3,})$/.exec((v ?? "").trim());
  return m ? Number(m[1]) : null;
}

/**
 * Next employee number for a new hire, given every number already in use.
 * Admins draw from the 1001–1100 band, staff from 1101+. Returns the highest
 * used number in that band + 1 (or the band start if empty), then skips any
 * value already taken so the result is globally unique.
 */
export function nextEmployeeNumber(existing: Array<string | null | undefined>, isAdmin: boolean): string {
  const taken = new Set(existing.map((x) => (x ?? "").trim()).filter(Boolean));
  const nums = existing.map(employeeNumberValue).filter((n): n is number => n != null);
  const inBand = isAdmin
    ? nums.filter((n) => n >= EMP_ADMIN_START && n < EMP_STAFF_START)
    : nums.filter((n) => n >= EMP_STAFF_START);
  let next = inBand.length ? Math.max(...inBand) + 1 : isAdmin ? EMP_ADMIN_START : EMP_STAFF_START;
  while (taken.has(`${EMP_NUMBER_PREFIX}${next}`)) next++;
  return `${EMP_NUMBER_PREFIX}${next}`;
}

// ── Leave allowance proration ────────────────────────────────────────────────
/** Months of service within `year`, counting the hiring month as a full month
 *  (hired before the year → 12; hired after → 0). */
export function serviceMonthsInYear(hiringDate: Date | null | undefined, year: number): number {
  if (!hiringDate) return 12;
  const hy = hiringDate.getUTCFullYear();
  if (hy > year) return 0;
  if (hy < year) return 12;
  return 12 - hiringDate.getUTCMonth(); // 0-indexed month → Dec inclusive
}

/** A full yearly allowance pro-rated to the employee's months of service in the
 *  hire year (round half-up). Full years return the full allowance unchanged. */
export function proratedAllowance(fullAllowance: number, hiringDate: Date | null | undefined, year: number): number {
  const months = serviceMonthsInYear(hiringDate, year);
  if (months >= 12) return fullAllowance;
  if (months <= 0) return 0;
  return Math.round((fullAllowance * months) / 12);
}

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

/**
 * Is this employee included in the payroll run? Driven by their Employee Type's
 * `payrollEligible` flag. Untyped employees default to INCLUDED so adding the
 * field never silently drops anyone from payroll until they're classified.
 */
export function includedInPayroll(employeeType: { payrollEligible: boolean } | null | undefined): boolean {
  return employeeType?.payrollEligible ?? true;
}

/** Validate the minimal new-employee inputs (name + email; rich fields optional). */
export function validateNewEmployee(input: { name?: string; email?: string }): Record<string, string> {
  const e: Record<string, string> = {};
  if (!input.name?.trim()) e.name = "err.nameRequired";
  if (!input.email?.trim()) e.email = "err.emailRequired";
  else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email.trim())) e.email = "err.emailInvalid";
  return e;
}
