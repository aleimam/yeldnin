import { describe, it, expect } from "vitest";
import {
  resolveCsConfig,
  valueFor,
  weightedTotal,
  normalizedPct,
  clampWeight,
  isCsLevel,
  DEFAULT_VALUES,
  compositeOverall,
  bonusPctFor,
  expectedBonus,
  isCsChannel,
  CS_CHANNELS,
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
  const map = DEFAULT_VALUES; // Perfect = 1 is the 100% mark; Outstanding = 1.5
  it("is 100% when every answer is Perfect", () => {
    expect(normalizedPct([{ weight: 2, value: 1 }, { weight: 3, value: 1 }], map)).toBe(100);
  });
  it("exceeds 100% when answers are Outstanding (above Perfect)", () => {
    expect(normalizedPct([{ weight: 2, value: 1.5 }], map)).toBe(150); // 3 / 2
  });
  it("is the weighted fraction of the Perfect ceiling", () => {
    expect(normalizedPct([{ weight: 4, value: 0.5 }], map)).toBe(50); // 2 / 4
  });
  it("goes below 0% for Catastrophe and returns 0 for empty", () => {
    expect(normalizedPct([{ weight: 2, value: -1 }], map)).toBe(-100); // -2 / 2
    expect(normalizedPct([], map)).toBe(0);
  });
});

describe("resolveCsConfig split", () => {
  it("defaults the overall-average split to 50/50", () => {
    expect(resolveCsConfig(null).split).toEqual({ calls: 50, performance: 50 });
  });
  it("merges a stored split", () => {
    expect(resolveCsConfig({ split: { calls: 60, performance: 40 } }).split).toEqual({ calls: 60, performance: 40 });
  });
});

describe("compositeOverall", () => {
  const types = [
    { name: "Normal", weight: 30 },
    { name: "Order", weight: 30 },
    { name: "Problem", weight: 40 },
  ];
  it("blends call types then the 50/50 calls/perf split", () => {
    const r = compositeOverall({
      callTypes: types,
      callEvals: [
        { typeName: "Normal", normalized: 100 },
        { typeName: "Order", normalized: 50 },
        { typeName: "Problem", normalized: 0 },
      ],
      perfEvals: [{ normalized: 80 }, { normalized: 60 }],
      callsWeight: 50,
      perfWeight: 50,
    });
    // calls = .3*100 + .3*50 + .4*0 = 45 ; perf = 70 ; overall = .5*45 + .5*70 = 57.5
    expect(r.callsBlock).toBe(45);
    expect(r.perfBlock).toBe(70);
    expect(r.overall).toBe(57.5);
  });
  it("averages multiple evals of the same call type", () => {
    const r = compositeOverall({ callTypes: types, callEvals: [{ typeName: "Normal", normalized: 100 }, { typeName: "Normal", normalized: 0 }], perfEvals: [], callsWeight: 50, perfWeight: 50 });
    expect(r.byType.find((t) => t.name === "Normal")?.avg).toBe(50);
    expect(r.callsBlock).toBe(50); // only Normal present → it is the whole block
    expect(r.overall).toBe(50); // no perf → calls is the whole overall
  });
  it("renormalizes the calls block when a type has no evals", () => {
    const r = compositeOverall({ callTypes: types, callEvals: [{ typeName: "Normal", normalized: 80 }, { typeName: "Order", normalized: 40 }], perfEvals: [], callsWeight: 50, perfWeight: 50 });
    // no Problem → Normal/Order renormalize 30/30 → 50/50 → .5*80 + .5*40 = 60
    expect(r.callsBlock).toBe(60);
    expect(r.overall).toBe(60);
  });
  it("renormalizes the split when one block is empty", () => {
    const r = compositeOverall({ callTypes: types, callEvals: [], perfEvals: [{ normalized: 90 }], callsWeight: 50, perfWeight: 50 });
    expect(r.callsBlock).toBeNull();
    expect(r.overall).toBe(90); // perf is the whole overall
  });
  it("returns null overall when there are no evals at all", () => {
    expect(compositeOverall({ callTypes: types, callEvals: [], perfEvals: [], callsWeight: 50, perfWeight: 50 }).overall).toBeNull();
  });
});

describe("bonus tiers", () => {
  const tiers = [
    { fromPct: 0, bonusPct: 0 },
    { fromPct: 76, bonusPct: 5 },
    { fromPct: 81, bonusPct: 10 },
    { fromPct: 96, bonusPct: 100 },
    { fromPct: 110, bonusPct: 120 },
  ];
  it("picks the highest threshold reached", () => {
    expect(bonusPctFor(50, tiers)).toBe(0);
    expect(bonusPctFor(78, tiers)).toBe(5);
    expect(bonusPctFor(96, tiers)).toBe(100);
    expect(bonusPctFor(130, tiers)).toBe(120); // over 100% allowed
  });
  it("below the lowest threshold and null → 0", () => {
    expect(bonusPctFor(-20, tiers)).toBe(0);
    expect(bonusPctFor(null, tiers)).toBe(0);
  });
  it("expected bonus = maxBonus × tier%", () => {
    expect(expectedBonus(82, 5000, tiers)).toBe(500); // 10% of 5000
    expect(expectedBonus(96, 5000, tiers)).toBe(5000); // 100%
    expect(expectedBonus(130, 5000, tiers)).toBe(6000); // 120%
    expect(expectedBonus(null, 5000, tiers)).toBe(0);
  });
});

describe("isCsChannel", () => {
  it("accepts the four fixed channel keys", () => {
    expect(CS_CHANNELS).toEqual(["WHATSAPP", "PHONE", "FACEBOOK", "INSTAGRAM"]);
    for (const c of CS_CHANNELS) expect(isCsChannel(c)).toBe(true);
  });
  it("rejects unknown / non-string values", () => {
    expect(isCsChannel("whatsapp")).toBe(false); // case-sensitive key
    expect(isCsChannel("EMAIL")).toBe(false);
    expect(isCsChannel("")).toBe(false);
    expect(isCsChannel(null)).toBe(false);
    expect(isCsChannel(undefined)).toBe(false);
    expect(isCsChannel(42)).toBe(false);
  });
});
