import { describe, it, expect } from "vitest";
import { convertToBase, ratesAreStale, egpBaseToMultipliers } from "./fx-logic";

const rates = new Map<string, number>([
  ["USD", 50],
  ["GBP", 63],
]);

describe("convertToBase", () => {
  it("passes EGP and empty currency through", () => {
    expect(convertToBase(100, "EGP", rates)).toEqual({ egp: 100, missing: false });
    expect(convertToBase(100, "", rates)).toEqual({ egp: 100, missing: false });
    expect(convertToBase(100, null, rates)).toEqual({ egp: 100, missing: false });
  });
  it("converts a foreign amount with a known rate", () => {
    expect(convertToBase(2, "USD", rates)).toEqual({ egp: 100, missing: false });
    expect(convertToBase(2, "usd", rates)).toEqual({ egp: 100, missing: false });
  });
  it("flags a foreign amount with no rate as missing (never zeroes silently)", () => {
    expect(convertToBase(2, "EUR", rates)).toEqual({ egp: 0, missing: true });
  });
  it("treats a zero/blank amount as 0 with no missing rate", () => {
    expect(convertToBase(0, "EUR", rates)).toEqual({ egp: 0, missing: false });
    expect(convertToBase(null, "USD", rates)).toEqual({ egp: 0, missing: false });
  });
});

describe("ratesAreStale", () => {
  const now = new Date("2026-06-17T12:00:00Z");
  it("is stale with no timestamp", () => {
    expect(ratesAreStale(null, now)).toBe(true);
  });
  it("is fresh under 24h", () => {
    expect(ratesAreStale(new Date("2026-06-17T00:00:00Z"), now)).toBe(false);
  });
  it("is stale at/over 24h", () => {
    expect(ratesAreStale(new Date("2026-06-16T12:00:00Z"), now)).toBe(true);
    expect(ratesAreStale(new Date("2026-06-15T00:00:00Z"), now)).toBe(true);
  });
});

describe("egpBaseToMultipliers", () => {
  it("inverts EGP→X into X→EGP and skips base + non-positive", () => {
    const m = egpBaseToMultipliers({ USD: 0.02, GBP: 0, EUR: 0.0182 }, ["EGP", "USD", "GBP", "EUR"]);
    expect(m.get("USD")).toBeCloseTo(50);
    expect(m.has("GBP")).toBe(false); // 0 → skipped
    expect(m.get("EUR")).toBeCloseTo(54.945, 2);
    expect(m.has("EGP")).toBe(false); // base skipped
  });
});
