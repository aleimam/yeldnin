import { describe, it, expect } from "vitest";
import {
  resolveCsConfig,
  valueFor,
  weightedTotal,
  normalizedPct,
  clampWeight,
  isCsLevel,
  DEFAULT_VALUES,
} from "./cs-logic";

describe("resolveCsConfig", () => {
  it("defaults both scopes to the monotonic set", () => {
    const c = resolveCsConfig(null);
    expect(c.call).toEqual({ CATASTROPHE: -1, BAD: 0, GOOD: 0.5, PERFECT: 1, OUTSTANDING: 1.5 });
    expect(c.performance).toEqual(c.call);
  });
  it("merges a partial override over defaults", () => {
    const c = resolveCsConfig({ call: { PERFECT: 2 } });
    expect(c.call.PERFECT).toBe(2);
    expect(c.call.OUTSTANDING).toBe(1.5);
    expect(c.performance).toEqual(DEFAULT_VALUES);
  });
});

describe("valueFor / isCsLevel", () => {
  it("resolves a level's value, 0 for unknown", () => {
    expect(valueFor(DEFAULT_VALUES, "OUTSTANDING")).toBe(1.5);
    expect(valueFor(DEFAULT_VALUES, "CATASTROPHE")).toBe(-1);
    expect(valueFor(DEFAULT_VALUES, "NOPE")).toBe(0);
  });
  it("validates levels", () => {
    expect(isCsLevel("GOOD")).toBe(true);
    expect(isCsLevel("great")).toBe(false);
  });
});

describe("clampWeight", () => {
  it("clamps to integer 1..10", () => {
    expect(clampWeight(0)).toBe(1);
    expect(clampWeight(5.4)).toBe(5);
    expect(clampWeight(99)).toBe(10);
  });
});

describe("weightedTotal", () => {
  it("sums value × weight", () => {
    expect(weightedTotal([{ weight: 2, value: 1.5 }, { weight: 3, value: -1 }])).toBe(0);
    expect(weightedTotal([{ weight: 4, value: 0.5 }])).toBe(2);
  });
});

describe("normalizedPct", () => {
  const map = DEFAULT_VALUES; // best = 1.5
  it("is 100% when every answer is the top value", () => {
    expect(normalizedPct([{ weight: 2, value: 1.5 }, { weight: 3, value: 1.5 }], map)).toBe(100);
  });
  it("is the weighted fraction of the ceiling", () => {
    expect(normalizedPct([{ weight: 4, value: 0.5 }], map)).toBe(33.33); // 2 / 6
  });
  it("clamps negatives to 0 and handles empty", () => {
    expect(normalizedPct([{ weight: 2, value: -1 }], map)).toBe(0);
    expect(normalizedPct([], map)).toBe(0);
  });
});
