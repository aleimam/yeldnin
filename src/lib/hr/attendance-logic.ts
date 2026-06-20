// Pure attendance/leave logic. No DB/IO. Unit-tested.
// Dates are handled in UTC with date-only keys so a date-input "YYYY-MM-DD"
// (parsed as UTC midnight) maps to a stable day + weekday.

export const LEAVE_TYPES = ["ANNUAL", "URGENT"] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];
export function isLeaveType(v: unknown): v is LeaveType {
  return typeof v === "string" && (LEAVE_TYPES as readonly string[]).includes(v);
}

// Vacation kinds (Phase 2.5): the three dated vacation classes.
export const HOLIDAY_TYPES = ["EID_DAYS", "EID_VACATION", "VACATION"] as const;
export type HolidayType = (typeof HOLIDAY_TYPES)[number];
export function isHolidayType(v: unknown): v is HolidayType {
  return typeof v === "string" && (HOLIDAY_TYPES as readonly string[]).includes(v);
}

// Configurable catalogs (Phase 2.5; EARNING added in Phase 3 for base pay).
export const COMPONENT_KINDS = ["EARNING", "BONUS", "PENALTY"] as const;
export type ComponentKind = (typeof COMPONENT_KINDS)[number];
export function isComponentKind(v: unknown): v is ComponentKind {
  return typeof v === "string" && (COMPONENT_KINDS as readonly string[]).includes(v);
}

export const DAY_CLASSES = ["LEAVE", "DUTY"] as const;
export type DayClass = (typeof DAY_CLASSES)[number];
export function isDayClass(v: unknown): v is DayClass {
  return typeof v === "string" && (DAY_CLASSES as readonly string[]).includes(v);
}

/** The duty DayType code that results from working a given vacation kind / weekend. */
export function dutyCodeFor(
  kind: "EID_DAYS" | "EID_VACATION" | "VACATION" | "WEEKEND",
  mapping: { dutyEidDays: string; dutyEidVacation: string; dutyVacation: string; dutyWeekend: string },
): string {
  switch (kind) {
    case "EID_DAYS":
      return mapping.dutyEidDays;
    case "EID_VACATION":
      return mapping.dutyEidVacation;
    case "VACATION":
      return mapping.dutyVacation;
    case "WEEKEND":
      return mapping.dutyWeekend;
  }
}

/** Date-only key in UTC ("YYYY-MM-DD"). */
export function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Parse "5,6" → Set{5,6} (JS getUTCDay numbers: 0=Sun..6=Sat). */
export function parseWeeklyOff(csv: string | null | undefined): Set<number> {
  return new Set(
    (csv ?? "")
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6),
  );
}

export function isWorkingDay(d: Date, weeklyOff: Set<number>, holidayKeys: Set<string>): boolean {
  return !weeklyOff.has(d.getUTCDay()) && !holidayKeys.has(ymd(d));
}

/** Working days in [start, end] inclusive, skipping weekly-off days + holidays. */
export function countWorkingDays(start: Date, end: Date, weeklyOff: Set<number>, holidayKeys: Set<string>): number {
  const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  if (last < cur) return 0;
  let count = 0;
  while (cur <= last) {
    if (isWorkingDay(cur, weeklyOff, holidayKeys)) count++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}

/** All date-only keys covered by a set of holiday ranges. */
export function expandHolidayKeys(ranges: { startDate: Date; endDate: Date }[]): Set<string> {
  const keys = new Set<string>();
  for (const r of ranges) {
    const cur = new Date(Date.UTC(r.startDate.getUTCFullYear(), r.startDate.getUTCMonth(), r.startDate.getUTCDate()));
    const last = new Date(Date.UTC(r.endDate.getUTCFullYear(), r.endDate.getUTCMonth(), r.endDate.getUTCDate()));
    while (cur <= last) {
      keys.add(ymd(cur));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  }
  return keys;
}

/** Effective yearly allowance for a type = per-employee override ?? company default. */
export function effectiveAllowance(override: number | null | undefined, fallback: number): number {
  return override ?? fallback;
}

/** Validate a leave-request draft. */
export function validateLeaveRequest(input: { type?: string; startDate?: string; endDate?: string }): Record<string, string> {
  const e: Record<string, string> = {};
  if (!isLeaveType(input.type)) e.type = "Choose a leave type.";
  if (!input.startDate) e.startDate = "Start date is required.";
  if (!input.endDate) e.endDate = "End date is required.";
  if (input.startDate && input.endDate && input.endDate < input.startDate) e.endDate = "End date must not be before the start date.";
  return e;
}
