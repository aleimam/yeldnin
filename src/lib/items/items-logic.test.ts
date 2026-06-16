import { describe, it, expect } from "vitest";
import { nextStatus, isForward, dueAutoAdvance, poolKey, isExceptionFlag } from "./items-logic";

describe("status progression", () => {
  it("advances along the canonical line and stops at the end", () => {
    expect(nextStatus("REQUESTED")).toBe("ORDERED");
    expect(nextStatus("ORDERED")).toBe("SHIPPED");
    expect(nextStatus("WEBSITE")).toBeNull();
  });
  it("isForward compares lifecycle position", () => {
    expect(isForward("REQUESTED", "WEBSITE")).toBe(true);
    expect(isForward("HUB", "ORDERED")).toBe(false);
    expect(isForward("HUB", "HUB")).toBe(false);
  });
});

describe("auto-advance timers", () => {
  const t0 = new Date("2026-06-01T00:00:00Z");
  const later = new Date("2026-06-10T00:00:00Z");
  it("HUB → TRANSIT once transitAt passes", () => {
    expect(dueAutoAdvance({ status: "HUB", transitAt: t0 }, later)).toBe("TRANSIT");
    expect(dueAutoAdvance({ status: "HUB", transitAt: later }, t0)).toBeNull();
  });
  it("TRANSIT → GLOBAL_SHIPPING once globalShippingAt passes", () => {
    expect(dueAutoAdvance({ status: "TRANSIT", globalShippingAt: t0 }, later)).toBe("GLOBAL_SHIPPING");
  });
  it("no timer set → no advance", () => {
    expect(dueAutoAdvance({ status: "HUB" }, later)).toBeNull();
    expect(dueAutoAdvance({ status: "ORDERED", transitAt: t0 }, later)).toBeNull();
  });
});

describe("pools & flags", () => {
  it("exception flag wins over container for the pool key", () => {
    expect(poolKey({ exceptionFlag: "LOST", containerType: "TRIP" })).toBe("EXC:LOST");
    expect(poolKey({ containerType: "TRIP" })).toBe("CON:TRIP");
    expect(poolKey({})).toBe("NONE");
  });
  it("validates exception flags", () => {
    expect(isExceptionFlag("DELAYED")).toBe(true);
    expect(isExceptionFlag("NOPE")).toBe(false);
  });
});
