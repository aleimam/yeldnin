import { describe, it, expect } from "vitest";
import { isVetoStatus, vetoQuota, canCastVeto } from "./cs-veto-logic";
import { clampVetoAllowance, resolveCsConfig, DEFAULT_VETO_ALLOWANCE } from "./cs-logic";

describe("veto statuses", () => {
  it("recognises the three states", () => {
    expect(isVetoStatus("PENDING")).toBe(true);
    expect(isVetoStatus("REJECTED")).toBe(true);
    expect(isVetoStatus("UPHELD")).toBe(true);
    expect(isVetoStatus("APPROVED")).toBe(false);
    expect(isVetoStatus(null)).toBe(false);
  });
});

describe("vetoQuota", () => {
  it("counts every cast veto, never negative", () => {
    expect(vetoQuota(5, 0)).toEqual({ allowance: 5, used: 0, remaining: 5 });
    expect(vetoQuota(5, 1)).toEqual({ allowance: 5, used: 1, remaining: 4 });
    expect(vetoQuota(5, 5)).toEqual({ allowance: 5, used: 5, remaining: 0 });
    expect(vetoQuota(5, 7)).toEqual({ allowance: 5, used: 7, remaining: 0 });
    expect(vetoQuota(0, 0)).toEqual({ allowance: 0, used: 0, remaining: 0 });
  });
});

describe("canCastVeto", () => {
  const base = { isSubject: true, evalStatus: "APPROVED", alreadyVetoed: false, remaining: 3 };
  it("allows the subject on an approved, un-vetoed eval with quota left", () => {
    expect(canCastVeto(base)).toBe(true);
  });
  it("blocks non-subjects, non-approved, already-vetoed, or no quota", () => {
    expect(canCastVeto({ ...base, isSubject: false })).toBe(false);
    expect(canCastVeto({ ...base, evalStatus: "PENDING" })).toBe(false);
    expect(canCastVeto({ ...base, alreadyVetoed: true })).toBe(false);
    expect(canCastVeto({ ...base, remaining: 0 })).toBe(false);
  });
});

describe("vetoAllowance config", () => {
  it("clamps to a non-negative integer, default 5", () => {
    expect(clampVetoAllowance(undefined)).toBe(DEFAULT_VETO_ALLOWANCE);
    expect(clampVetoAllowance(5)).toBe(5);
    expect(clampVetoAllowance(0)).toBe(0);
    expect(clampVetoAllowance(-3)).toBe(0);
    expect(clampVetoAllowance(3.6)).toBe(4);
    expect(clampVetoAllowance(1000)).toBe(99);
    expect(clampVetoAllowance("x")).toBe(DEFAULT_VETO_ALLOWANCE);
  });
  it("resolveCsConfig fills the allowance default", () => {
    expect(resolveCsConfig(null).vetoAllowance).toBe(DEFAULT_VETO_ALLOWANCE);
    expect(resolveCsConfig({ vetoAllowance: 3 }).vetoAllowance).toBe(3);
  });
});
