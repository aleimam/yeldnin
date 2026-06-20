import { describe, it, expect } from "vitest";
import {
  applyChange,
  validateChange,
  monthlyBaseEarnings,
  dayOfBasic,
  round2,
  isValuation,
  isDayValuation,
  isChangeType,
} from "./salary-logic";

describe("applyChange", () => {
  it("SET overwrites with the absolute figure", () => {
    expect(applyChange(5000, "SET", 6000)).toBe(6000);
    expect(applyChange(0, "SET", 4500)).toBe(4500);
  });
  it("FIXED adds a signed delta", () => {
    expect(applyChange(5000, "FIXED", 100)).toBe(5100);
    expect(applyChange(5000, "FIXED", -250)).toBe(4750);
  });
  it("PERCENT scales by percent of old", () => {
    expect(applyChange(5000, "PERCENT", 10)).toBe(5500);
    expect(applyChange(5000, "PERCENT", -20)).toBe(4000);
  });
  it("never goes below zero", () => {
    expect(applyChange(100, "FIXED", -500)).toBe(0);
    expect(applyChange(100, "PERCENT", -150)).toBe(0);
  });
  it("rounds to 2 decimals", () => {
    expect(applyChange(3333.33, "PERCENT", 10)).toBe(3666.66);
    expect(applyChange(1, "FIXED", 0.005)).toBe(1.01);
  });
});

describe("validateChange", () => {
  it("accepts a well-formed change", () => {
    expect(validateChange({ type: "PERCENT", delta: "10", effectiveDate: "2026-06-20" })).toEqual({});
  });
  it("rejects bad type / missing delta / missing date", () => {
    const e = validateChange({ type: "NOPE", delta: "", effectiveDate: "" });
    expect(e.type).toBeTruthy();
    expect(e.delta).toBeTruthy();
    expect(e.effectiveDate).toBeTruthy();
  });
  it("rejects negative SET and ≤-100% percent", () => {
    expect(validateChange({ type: "SET", delta: -1, effectiveDate: "2026-06-20" }).delta).toBeTruthy();
    expect(validateChange({ type: "PERCENT", delta: -100, effectiveDate: "2026-06-20" }).delta).toBeTruthy();
  });
});

describe("monthlyBaseEarnings", () => {
  const earn = (amount: number, valuation = "FIXED_MONTHLY", active = true) => ({
    amount,
    active,
    component: { kind: "EARNING", valuation },
  });
  it("sums only active FIXED_MONTHLY earnings", () => {
    const lines = [
      earn(5000),
      earn(500), // allowance
      earn(999, "FIXED_MONTHLY", false), // inactive — excluded
      { amount: 800, active: true, component: { kind: "BONUS", valuation: "FIXED_EVENT" } }, // bonus — excluded
      { amount: 200, active: true, component: { kind: "PENALTY", valuation: "FIXED_EVENT" } }, // penalty — excluded
    ];
    expect(monthlyBaseEarnings(lines)).toBe(5500);
  });
  it("is zero with no earnings", () => {
    expect(monthlyBaseEarnings([])).toBe(0);
  });
});

describe("valuation + change guards", () => {
  it("isValuation / isDayValuation", () => {
    expect(isValuation("FIXED_MONTHLY")).toBe(true);
    expect(isValuation("nope")).toBe(false);
    expect(isDayValuation("DAYS_OF_BASIC")).toBe(true);
    expect(isDayValuation("DAYS_OF_TOTAL")).toBe(true);
    expect(isDayValuation("FIXED_EVENT")).toBe(false);
  });
  it("isChangeType", () => {
    expect(isChangeType("SET")).toBe(true);
    expect(isChangeType("RAISE")).toBe(false);
  });
  it("dayOfBasic uses the 26-day divisor and guards zero", () => {
    expect(dayOfBasic(5200)).toBe(200);
    expect(dayOfBasic(5000, 0)).toBe(0);
  });
  it("round2 avoids float drift", () => {
    expect(round2(1.005)).toBe(1.01);
  });
});
