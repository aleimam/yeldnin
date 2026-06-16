import { describe, it, expect } from "vitest";
import {
  ITEM_STATUS_ORDER,
  DEFAULT_LABELS,
  resolveWorkflow,
  autoAdvanceSchedule,
} from "./workflow-logic";

describe("item status catalog", () => {
  it("has the 12 canonical steps and a label for each", () => {
    expect(ITEM_STATUS_ORDER).toHaveLength(12);
    for (const s of ITEM_STATUS_ORDER) {
      expect(DEFAULT_LABELS[s].en).toBeTruthy();
      expect(DEFAULT_LABELS[s].ar).toBeTruthy();
    }
  });
});

describe("label resolution", () => {
  it("returns default labels with no overrides", () => {
    const w = resolveWorkflow();
    expect(w.label("GLOBAL_SHIPPING", "en")).toBe("Global Shipping");
    expect(w.label("HUB", "ar")).toBe("في المخزن");
  });
  it("honors an admin label override (per locale)", () => {
    const w = resolveWorkflow({ labels: { GLOBAL_SHIPPING: { en: "Intl. Freight" } } });
    expect(w.label("GLOBAL_SHIPPING", "en")).toBe("Intl. Freight");
    // un-overridden locale falls back to default
    expect(w.label("GLOBAL_SHIPPING", "ar")).toBe("شحن دولي");
  });
});

describe("Sales-facing status (carry-forward)", () => {
  const w = resolveWorkflow();
  it("normal items show every step", () => {
    expect(w.salesLabel("DELIVERED", false, "en")).toBe("Delivered");
    expect(w.salesLabel("CUSTOMS", false, "en")).toBe("Customs");
  });
  it("special orders carry the previous milestone through blank steps", () => {
    expect(w.salesLabel("DELIVERED", true, "en")).toBe("Shipped"); // Delivered hidden
    expect(w.salesLabel("HUB", true, "en")).toBe("Shipped");
    expect(w.salesLabel("TRANSIT", true, "en")).toBe("Shipped");
    expect(w.salesLabel("GLOBAL_SHIPPING", true, "en")).toBe("Global Shipping"); // shown again
    expect(w.salesLabel("CUSTOMS", true, "en")).toBe("Global Shipping"); // Customs hidden
    expect(w.salesLabel("WEBSITE", true, "en")).toBe("Website");
  });
  it("respects an override that changes the carry-forward set", () => {
    const w2 = resolveWorkflow({ carryForward: { SALES_SPECIAL: ["DELIVERED"] } });
    expect(w2.salesLabel("HUB", true, "en")).toBe("Hub"); // HUB no longer hidden
    expect(w2.salesLabel("DELIVERED", true, "en")).toBe("Shipped"); // still hidden
  });
});

describe("auto-advance schedule", () => {
  const received = new Date("2026-06-01T00:00:00Z");
  const days = (d: Date) => Math.round((d.getTime() - received.getTime()) / 86_400_000);
  it("uses the minimum of each range when rand=0", () => {
    const s = autoAdvanceSchedule(received, () => 0);
    expect(days(s.transitAt)).toBe(2);
    expect(days(s.globalShippingAt)).toBe(4);
  });
  it("uses the maximum when rand→1", () => {
    const s = autoAdvanceSchedule(received, () => 0.999);
    expect(days(s.transitAt)).toBe(4);
    expect(days(s.globalShippingAt)).toBe(6);
  });
  it("never schedules Global Shipping before Transit", () => {
    // transit range pushed high, global range low → global clamps up to transit
    const s = autoAdvanceSchedule(received, () => 0.999, {
      TRANSIT: { min: 6, max: 6 },
      GLOBAL_SHIPPING: { min: 1, max: 1 },
    });
    expect(s.globalShippingAt.getTime()).toBeGreaterThanOrEqual(s.transitAt.getTime());
  });
});
