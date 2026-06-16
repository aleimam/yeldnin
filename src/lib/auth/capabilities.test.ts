import { describe, it, expect } from "vitest";
import {
  CAPABILITIES,
  CAPABILITY_MODULES,
  capabilitiesForModule,
  getCapability,
  resolveCapabilityLevel,
  defaultPolicy,
} from "./capabilities";
import { isLevel } from "./access-logic";

describe("capability catalog", () => {
  it("has unique module.key identifiers and valid default levels", () => {
    const seen = new Set<string>();
    for (const c of CAPABILITIES) {
      const id = `${c.module}.${c.key}`;
      expect(seen.has(id), `duplicate ${id}`).toBe(false);
      seen.add(id);
      expect(isLevel(c.defaultLevel)).toBe(true);
      expect(CAPABILITY_MODULES).toContain(c.module);
    }
  });

  it("every catalog module exposes at least one capability", () => {
    for (const m of CAPABILITY_MODULES) {
      expect(capabilitiesForModule(m).length).toBeGreaterThan(0);
    }
  });
});

describe("resolveCapabilityLevel", () => {
  it("returns the default when there is no override", () => {
    expect(resolveCapabilityLevel(null, "pricing", "deleteAny")).toBe("MANAGE");
    expect(resolveCapabilityLevel({}, "pricing", "calculate")).toBe("OPERATE");
  });

  it("honors a valid override", () => {
    expect(resolveCapabilityLevel({ pricing: { deleteAny: "OPERATE" } }, "pricing", "deleteAny")).toBe("OPERATE");
  });

  it("ignores an invalid override and falls back to default", () => {
    expect(
      resolveCapabilityLevel({ pricing: { deleteAny: "BOGUS" as unknown as "MANAGE" } }, "pricing", "deleteAny"),
    ).toBe("MANAGE");
  });

  it("fails safe to MANAGE for an unknown capability", () => {
    expect(resolveCapabilityLevel({}, "pricing", "nope")).toBe("MANAGE");
    expect(getCapability("pricing", "nope")).toBeUndefined();
  });
});

describe("defaultPolicy", () => {
  it("mirrors the catalog defaults for every capability", () => {
    const dp = defaultPolicy();
    for (const c of CAPABILITIES) {
      expect(dp[c.module]?.[c.key]).toBe(c.defaultLevel);
    }
  });
});
