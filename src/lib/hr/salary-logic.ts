// Pure salary-structure logic (HR Phase 3). No DB/IO. Unit-tested.
// A salary is the sum of EARNING + BONUS component figures minus PENALTY figures;
// the figure on each structure line is interpreted by the component's `valuation`.

// How a structure line's `amount` is read (see SalaryComponent in schema.prisma):
//   FIXED_MONTHLY  constant monthly EGP        (Basic, fixed allowances)
//   FIXED_EVENT    fixed EGP when earned/charged (target bonus, flat penalty)
//   PER_DAY_FIXED  fixed EGP per qualifying day  (working a vacation/Eid)
//   DAYS_OF_BASIC  N days × (basic ÷ 26)         (bonus expressed in days)
//   DAYS_OF_TOTAL  N days × (total ÷ working)    (penalty expressed in days)
export const VALUATIONS = ["FIXED_MONTHLY", "FIXED_EVENT", "PER_DAY_FIXED", "DAYS_OF_BASIC", "DAYS_OF_TOTAL"] as const;
export type Valuation = (typeof VALUATIONS)[number];
export function isValuation(v: unknown): v is Valuation {
  return typeof v === "string" && (VALUATIONS as readonly string[]).includes(v);
}

/** Valuations whose figure is a day-count rather than EGP. */
export function isDayValuation(v: string): boolean {
  return v === "DAYS_OF_BASIC" || v === "DAYS_OF_TOTAL";
}

// A raise/change is applied one of three ways. SET overwrites; FIXED adds a signed
// EGP delta; PERCENT scales by a percentage of the old figure.
export const CHANGE_TYPES = ["SET", "FIXED", "PERCENT"] as const;
export type ChangeType = (typeof CHANGE_TYPES)[number];
export function isChangeType(v: unknown): v is ChangeType {
  return typeof v === "string" && (CHANGE_TYPES as readonly string[]).includes(v);
}

/** Round to 2 decimals, avoiding binary-float drift (e.g. 1.005 → 1.01). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Resulting figure after applying a change to an old figure.
 *   SET     → delta (the new absolute figure)
 *   FIXED   → old + delta (delta may be negative)
 *   PERCENT → old × (1 + delta/100)
 * Never returns below zero. Rounded to 2 decimals.
 */
export function applyChange(oldAmount: number, type: ChangeType, delta: number): number {
  let next: number;
  switch (type) {
    case "SET":
      next = delta;
      break;
    case "FIXED":
      next = oldAmount + delta;
      break;
    case "PERCENT":
      next = oldAmount * (1 + delta / 100);
      break;
  }
  return round2(Math.max(0, next));
}

export interface DraftChange {
  type?: string;
  delta?: string | number;
  effectiveDate?: string;
}

/** Validate a raise/change draft. Returns field → message (empty = valid). */
export function validateChange(input: DraftChange): Record<string, string> {
  const e: Record<string, string> = {};
  if (!isChangeType(input.type)) e.type = "Choose how to apply the change.";
  const delta = typeof input.delta === "string" ? parseFloat(input.delta) : input.delta;
  if (delta == null || Number.isNaN(delta)) e.delta = "Enter a value.";
  else if (input.type === "SET" && delta < 0) e.delta = "Amount cannot be negative.";
  else if (input.type === "PERCENT" && delta <= -100) e.delta = "Percentage would zero the amount.";
  if (!input.effectiveDate) e.effectiveDate = "Effective date is required.";
  return e;
}

export interface StructureLine {
  amount: number;
  active: boolean;
  component: { kind: string; valuation: string };
}

/**
 * Preview of the recurring monthly base = sum of active EARNING lines that are
 * paid every month (FIXED_MONTHLY). Bonuses/penalties depend on the month's
 * attendance/targets and are computed by the Payroll run (Phase 4), so they are
 * intentionally excluded here.
 */
export function monthlyBaseEarnings(lines: StructureLine[]): number {
  return round2(
    lines
      .filter((l) => l.active && l.component.kind === "EARNING" && l.component.valuation === "FIXED_MONTHLY")
      .reduce((sum, l) => sum + l.amount, 0),
  );
}

/** Daily value of basic salary per the doc's fixed 26-day divisor. */
export function dayOfBasic(basicMonthly: number, divisor = 26): number {
  return divisor > 0 ? round2(basicMonthly / divisor) : 0;
}
