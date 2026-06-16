import { describe, it, expect } from "vitest";
import { monthKey, monthRange, monthCloseable, toEgp, validateStaffShares } from "./xoonx-finance-logic";

describe("month helpers", () => {
  it("monthKey formats YYYY-MM", () => {
    expect(monthKey(new Date(2026, 5, 17))).toBe("2026-06"); // month is 0-based → June
    expect(monthKey(new Date(2026, 11, 1))).toBe("2026-12");
  });
  it("monthRange spans the calendar month", () => {
    const { gte, lt } = monthRange("2026-06");
    expect(gte).toEqual(new Date(2026, 5, 1));
    expect(lt).toEqual(new Date(2026, 6, 1));
  });
  it("monthCloseable only 7 days after month end", () => {
    expect(monthCloseable("2026-06", new Date(2026, 6, 1))).toBe(false); // day after end
    expect(monthCloseable("2026-06", new Date(2026, 6, 7))).toBe(false); // 6 days after
    expect(monthCloseable("2026-06", new Date(2026, 6, 8))).toBe(true); // 7 days after
  });
});

describe("toEgp", () => {
  const rates = new Map([["USD", 50], ["GBP", 63]]);
  it("passes EGP / empty through", () => {
    expect(toEgp(100, "EGP", rates)).toEqual({ egp: 100, missing: false });
    expect(toEgp(100, null, rates)).toEqual({ egp: 100, missing: false });
    expect(toEgp(0, "USD", rates)).toEqual({ egp: 0, missing: false });
  });
  it("converts a foreign amount with a set rate", () => {
    expect(toEgp(10, "USD", rates)).toEqual({ egp: 500, missing: false });
  });
  it("flags missing when the rate is absent", () => {
    expect(toEgp(10, "EUR", rates)).toEqual({ egp: 0, missing: true });
  });
});

describe("validateStaffShares", () => {
  it("accepts all-zero (equal default)", () => {
    expect(validateStaffShares([{ sharePct: 0 }, { sharePct: 0 }])).toBeNull();
  });
  it("accepts a total of 100", () => {
    expect(validateStaffShares([{ sharePct: 60 }, { sharePct: 40 }])).toBeNull();
  });
  it("rejects a non-100 total", () => {
    expect(validateStaffShares([{ sharePct: 60 }, { sharePct: 30 }])).toMatch(/100%/);
  });
  it("rejects a negative share", () => {
    expect(validateStaffShares([{ sharePct: -10 }, { sharePct: 110 }])).toMatch(/negative/);
  });
});
