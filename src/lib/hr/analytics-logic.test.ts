import { describe, it, expect } from "vitest";
import { average, median, sumByKey, recentMonths, monthLabel } from "./analytics-logic";

describe("average", () => {
  it("means a set, 0 when empty", () => {
    expect(average([10, 20, 30])).toBe(20);
    expect(average([])).toBe(0);
    expect(average([1, 2])).toBe(1.5);
  });
});

describe("median", () => {
  it("middle for odd counts", () => {
    expect(median([3, 1, 2])).toBe(2);
  });
  it("mean of two middles for even counts", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
  it("0 when empty; single value", () => {
    expect(median([])).toBe(0);
    expect(median([7])).toBe(7);
  });
});

describe("sumByKey", () => {
  it("buckets and sums", () => {
    const rows = [
      { team: "sales", amt: 100 },
      { team: "sales", amt: 50 },
      { team: "ops", amt: 200 },
    ];
    expect(sumByKey(rows, (r) => r.team, (r) => r.amt)).toEqual({ sales: 150, ops: 200 });
  });
});

describe("recentMonths", () => {
  it("returns n months oldest→newest, wrapping the year", () => {
    expect(recentMonths(2026, 2, 4)).toEqual([
      { year: 2025, month: 11 },
      { year: 2025, month: 12 },
      { year: 2026, month: 1 },
      { year: 2026, month: 2 },
    ]);
  });
  it("single month", () => {
    expect(recentMonths(2026, 6, 1)).toEqual([{ year: 2026, month: 6 }]);
  });
});

describe("monthLabel", () => {
  it("zero-pads the month", () => {
    expect(monthLabel(2026, 6)).toBe("2026-06");
    expect(monthLabel(2026, 12)).toBe("2026-12");
  });
});
