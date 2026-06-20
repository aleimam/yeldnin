// Pure payroll engine (HR Phase 4). No DB/IO. Unit-tested.
// A payslip is a set of breakdown lines; each line's money `amount` is resolved
// from its valuation + a quantity and a rate, against two day-values:
//   dayOfBasic = basic ÷ 26            (doc's fixed divisor for days-of-basic)
//   dayOfTotal = gross ÷ workingDays   (working days = company days in the month)
// Net = max(0, Σearnings + Σbonuses − Σpenalties)  (floored at zero).
import { round2 } from "./salary-logic";

export const PAYSLIP_STATUSES = ["DRAFT", "LOCKED"] as const;
export type PayslipStatus = (typeof PAYSLIP_STATUSES)[number];

export const LINE_SOURCES = ["STRUCTURE", "DUTY", "TARGET", "ABSENCE", "ADHOC"] as const;
export type LineSource = (typeof LINE_SOURCES)[number];
/** Auto-derived sources are regenerated on every recompute; the rest are manual. */
export const AUTO_SOURCES: readonly string[] = ["STRUCTURE", "DUTY", "ABSENCE"];
export function isManualSource(source: string): boolean {
  return !AUTO_SOURCES.includes(source);
}

export const BASIC_DIVISOR = 26;
export const ABSENCE_PENALTY_DAYS = 2; // over-limit absence = 2 days of total each

/** Daily value of basic salary (doc: basic ÷ 26). */
export function dayOfBasic(basic: number, divisor = BASIC_DIVISOR): number {
  return divisor > 0 ? round2(basic / divisor) : 0;
}

/** Daily value of total/gross salary (gross ÷ company working days in the month). */
export function dayOfTotalValue(gross: number, workingDays: number): number {
  return workingDays > 0 ? round2(gross / workingDays) : 0;
}

/** Previous calendar month (for the literal-split: bonuses come from M−1). */
export function prevMonth(year: number, month: number): { year: number; month: number } {
  return month <= 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

export interface LineSpec {
  valuation: string | null; // FIXED_MONTHLY | FIXED_EVENT | PER_DAY_FIXED | DAYS_OF_BASIC | DAYS_OF_TOTAL
  qty?: number | null; // duty-day count, or number of days for days-of-X
  rate?: number | null; // per-day or fixed figure (days-of-X use rate as a multiplier, default 1)
}

/**
 * Money amount for one line, by valuation:
 *   FIXED_MONTHLY / FIXED_EVENT → rate                       (qty ignored)
 *   PER_DAY_FIXED               → qty × rate
 *   DAYS_OF_BASIC               → qty × rate × dayOfBasic
 *   DAYS_OF_TOTAL               → qty × rate × dayOfTotal
 * Always ≥ 0 and rounded to 2 decimals (sign is implied by the line's kind).
 */
export function resolveLineAmount(line: LineSpec, ctx: { dayOfBasic: number; dayOfTotal: number }): number {
  const qty = line.qty ?? 0;
  const rate = line.rate ?? 0;
  let amount: number;
  switch (line.valuation) {
    case "PER_DAY_FIXED":
      amount = qty * rate;
      break;
    case "DAYS_OF_BASIC":
      amount = qty * (line.rate ?? 1) * ctx.dayOfBasic;
      break;
    case "DAYS_OF_TOTAL":
      amount = qty * (line.rate ?? 1) * ctx.dayOfTotal;
      break;
    default: // FIXED_MONTHLY | FIXED_EVENT | null
      amount = rate;
  }
  return round2(Math.max(0, amount));
}

export interface RollupLine {
  kind: string; // EARNING | BONUS | PENALTY
  amount: number;
}
export interface Totals {
  earningsTotal: number;
  bonusTotal: number;
  penaltyTotal: number;
  gross: number;
  net: number;
}

/** Roll a set of resolved lines up to header totals. Net is floored at zero. */
export function rollupTotals(lines: RollupLine[]): Totals {
  const sum = (k: string) => round2(lines.filter((l) => l.kind === k).reduce((s, l) => s + l.amount, 0));
  const earningsTotal = sum("EARNING");
  const bonusTotal = sum("BONUS");
  const penaltyTotal = sum("PENALTY");
  const gross = round2(earningsTotal + bonusTotal);
  const net = round2(Math.max(0, gross - penaltyTotal));
  return { earningsTotal, bonusTotal, penaltyTotal, gross, net };
}
