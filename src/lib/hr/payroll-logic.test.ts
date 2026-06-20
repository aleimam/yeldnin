import { describe, it, expect } from "vitest";
import {
  dayOfBasic,
  dayOfTotalValue,
  prevMonth,
  resolveLineAmount,
  rollupTotals,
  isManualSource,
  ABSENCE_PENALTY_DAYS,
} from "./payroll-logic";

const ctx = (b: number, total: number, wd: number) => ({ dayOfBasic: dayOfBasic(b), dayOfTotal: dayOfTotalValue(total, wd) });

describe("day-values", () => {
  it("dayOfBasic uses ÷26", () => {
    expect(dayOfBasic(5200)).toBe(200);
    expect(dayOfBasic(5000, 0)).toBe(0);
  });
  it("dayOfTotal = gross ÷ working days", () => {
    expect(dayOfTotalValue(6600, 22)).toBe(300);
    expect(dayOfTotalValue(6600, 0)).toBe(0);
  });
});

describe("prevMonth (literal-split bonus month)", () => {
  it("steps back, wrapping the year", () => {
    expect(prevMonth(2026, 6)).toEqual({ year: 2026, month: 5 });
    expect(prevMonth(2026, 1)).toEqual({ year: 2025, month: 12 });
  });
});

describe("resolveLineAmount", () => {
  const c = { dayOfBasic: 200, dayOfTotal: 300 };
  it("fixed valuations return the rate", () => {
    expect(resolveLineAmount({ valuation: "FIXED_MONTHLY", rate: 5000 }, c)).toBe(5000);
    expect(resolveLineAmount({ valuation: "FIXED_EVENT", rate: 800 }, c)).toBe(800);
  });
  it("per-day fixed = qty × rate (duty days × rate)", () => {
    expect(resolveLineAmount({ valuation: "PER_DAY_FIXED", qty: 3, rate: 150 }, c)).toBe(450);
  });
  it("days-of-basic = qty × rate × dayOfBasic", () => {
    // 2 duty days, 1 day-of-basic each
    expect(resolveLineAmount({ valuation: "DAYS_OF_BASIC", qty: 2, rate: 1 }, c)).toBe(400);
    // ad-hoc: 1.5 days of basic
    expect(resolveLineAmount({ valuation: "DAYS_OF_BASIC", qty: 1.5, rate: 1 }, c)).toBe(300);
  });
  it("days-of-total = qty × rate × dayOfTotal (absence: 2 days each)", () => {
    // 2 over-limit absences × 2 days = qty 4
    expect(resolveLineAmount({ valuation: "DAYS_OF_TOTAL", qty: 2 * ABSENCE_PENALTY_DAYS, rate: 1 }, c)).toBe(1200);
  });
  it("never negative, rounds to 2dp", () => {
    expect(resolveLineAmount({ valuation: "PER_DAY_FIXED", qty: 1, rate: -50 }, c)).toBe(0);
    expect(resolveLineAmount({ valuation: "DAYS_OF_BASIC", qty: 1, rate: 1 }, { dayOfBasic: 33.335, dayOfTotal: 0 })).toBe(33.34);
  });
});

describe("rollupTotals", () => {
  it("gross = earnings + bonuses; net floors at zero", () => {
    const lines = [
      { kind: "EARNING", amount: 5000 },
      { kind: "EARNING", amount: 500 },
      { kind: "BONUS", amount: 800 },
      { kind: "PENALTY", amount: 300 },
    ];
    expect(rollupTotals(lines)).toEqual({ earningsTotal: 5500, bonusTotal: 800, penaltyTotal: 300, gross: 6300, net: 6000 });
  });
  it("net never below zero", () => {
    const lines = [
      { kind: "EARNING", amount: 1000 },
      { kind: "PENALTY", amount: 4000 },
    ];
    const r = rollupTotals(lines);
    expect(r.gross).toBe(1000);
    expect(r.net).toBe(0);
  });
});

describe("end-to-end: a realistic slip", () => {
  it("basic + duty bonus (M−1) + 1 over-limit absence (M)", () => {
    const basic = 5200;
    const c = ctx(basic, 0, 22); // dayOfBasic 200; dayOfTotal filled after gross
    // earnings + bonuses first
    const earning = resolveLineAmount({ valuation: "FIXED_MONTHLY", rate: 5200 }, c);
    const allowance = resolveLineAmount({ valuation: "FIXED_MONTHLY", rate: 300 }, c);
    const dutyBonus = resolveLineAmount({ valuation: "PER_DAY_FIXED", qty: 2, rate: 150 }, c); // 300
    const pre = rollupTotals([
      { kind: "EARNING", amount: earning },
      { kind: "EARNING", amount: allowance },
      { kind: "BONUS", amount: dutyBonus },
    ]);
    expect(pre.gross).toBe(5800);
    // now penalties use dayOfTotal = gross ÷ 22
    const dot = dayOfTotalValue(pre.gross, 22); // 263.64
    const absence = resolveLineAmount({ valuation: "DAYS_OF_TOTAL", qty: 1 * ABSENCE_PENALTY_DAYS, rate: 1 }, { dayOfBasic: 200, dayOfTotal: dot });
    expect(absence).toBe(round2(2 * dot));
    const final = rollupTotals([
      { kind: "EARNING", amount: earning },
      { kind: "EARNING", amount: allowance },
      { kind: "BONUS", amount: dutyBonus },
      { kind: "PENALTY", amount: absence },
    ]);
    expect(final.net).toBe(round2(5800 - 2 * dot));
  });
});

describe("isManualSource", () => {
  it("STRUCTURE/DUTY/ABSENCE are auto; TARGET/ADHOC are manual", () => {
    expect(isManualSource("STRUCTURE")).toBe(false);
    expect(isManualSource("DUTY")).toBe(false);
    expect(isManualSource("ABSENCE")).toBe(false);
    expect(isManualSource("TARGET")).toBe(true);
    expect(isManualSource("ADHOC")).toBe(true);
  });
});

// round2 re-exported indirectly; import here to keep the test self-contained.
import { round2 } from "./salary-logic";
