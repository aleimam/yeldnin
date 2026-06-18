import { describe, it, expect } from "vitest";
import {
  nextStatus,
  isForward,
  dueAutoAdvance,
  poolKey,
  isExceptionFlag,
  itemBucket,
  categoryBucket,
  tallyCategories,
  PRE_RECEIPT_STATUSES,
  HOLD_FLAGS,
} from "./items-logic";

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

describe("dashboard buckets", () => {
  it("maps statuses to buckets", () => {
    expect(itemBucket("REQUESTED", null)).toBe("requested");
    expect(itemBucket("ORDERED", null)).toBe("onOrder");
    expect(itemBucket("DELIVERED", null)).toBe("onOrder");
    expect(itemBucket("HUB", null)).toBe("inStock");
    expect(itemBucket("OFFICE", null)).toBe("inStock");
    expect(itemBucket("WEBSITE", null)).toBe("onWebsite");
  });
  it("an exception flag always wins → problems", () => {
    expect(itemBucket("REQUESTED", "DELAYED")).toBe("problems");
    expect(itemBucket("WEBSITE", "LOST")).toBe("problems");
  });
});

describe("category buckets", () => {
  it("scope wins for personal/xoonx, then product type under EGV", () => {
    expect(categoryBucket("PERSONAL", "DEVICE")).toBe("personal");
    expect(categoryBucket("XOONX", "SUPPLEMENT")).toBe("xoonx");
    expect(categoryBucket("EGV", "INJECTION")).toBe("injection");
    expect(categoryBucket("EGV", "DEVICE")).toBe("devices");
    expect(categoryBucket("EGV", "SUPPLEMENT")).toBe("items");
    expect(categoryBucket("EGV", "HEAVY_SUPPLEMENT")).toBe("items");
    expect(categoryBucket("EGV", null)).toBe("items");
  });
  it("tally is exclusive — buckets sum to the total", () => {
    const c = tallyCategories([
      { scope: "EGV", productType: "SUPPLEMENT" },
      { scope: "EGV", productType: "SUPPLEMENT" },
      { scope: "EGV", productType: "INJECTION" },
      { scope: "EGV", productType: "DEVICE" },
      { scope: "XOONX", productType: "XOONX" },
      { scope: "PERSONAL", productType: "SUPPLEMENT" },
    ]);
    expect(c).toEqual({ total: 6, items: 2, injection: 1, devices: 1, xoonx: 1, personal: 1 });
    expect(c.items + c.injection + c.devices + c.xoonx + c.personal).toBe(c.total);
  });
});

describe("movement constants", () => {
  it("pre-receipt statuses are everything before HUB", () => {
    expect(PRE_RECEIPT_STATUSES).toEqual(["REQUESTED", "ORDERED", "SHIPPED", "DELIVERED"]);
  });
  it("hold flags pin items in place but never DELAYED", () => {
    expect(HOLD_FLAGS).toEqual(["LOST", "DAMAGED", "ERRANT"]);
    expect(HOLD_FLAGS).not.toContain("DELAYED");
  });
});
