import { describe, it, expect } from "vitest";
import {
  levelMeets,
  isAdminTier,
  effectiveLevel,
  canAccessModule,
} from "./access-logic";

describe("levelMeets", () => {
  it("higher levels satisfy lower thresholds", () => {
    expect(levelMeets("MANAGE", "VIEW")).toBe(true);
    expect(levelMeets("OPERATE", "VIEW")).toBe(true);
    expect(levelMeets("VIEW", "VIEW")).toBe(true);
  });
  it("lower levels do not satisfy higher thresholds", () => {
    expect(levelMeets("VIEW", "OPERATE")).toBe(false);
    expect(levelMeets("NONE", "VIEW")).toBe(false);
    expect(levelMeets("OPERATE", "MANAGE")).toBe(false);
  });
});

describe("isAdminTier", () => {
  it("admins and super-admins are admin tier", () => {
    expect(isAdminTier("SUPER_ADMIN")).toBe(true);
    expect(isAdminTier("ADMIN")).toBe(true);
    expect(isAdminTier("MEMBER")).toBe(false);
  });
});

describe("effectiveLevel", () => {
  it("admin tiers always get MANAGE regardless of per-user level", () => {
    expect(effectiveLevel("ADMIN", undefined)).toBe("MANAGE");
    expect(effectiveLevel("SUPER_ADMIN", "NONE")).toBe("MANAGE");
  });
  it("members get their per-user level, defaulting to NONE", () => {
    expect(effectiveLevel("MEMBER", "OPERATE")).toBe("OPERATE");
    expect(effectiveLevel("MEMBER", undefined)).toBe("NONE");
  });
});

describe("canAccessModule", () => {
  it("members need at least VIEW", () => {
    expect(canAccessModule("MEMBER", "VIEW")).toBe(true);
    expect(canAccessModule("MEMBER", "NONE")).toBe(false);
    expect(canAccessModule("MEMBER", undefined)).toBe(false);
  });
  it("admins always have access", () => {
    expect(canAccessModule("ADMIN", undefined)).toBe(true);
  });
});
