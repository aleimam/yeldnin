import { describe, it, expect } from "vitest";
import {
  resolveSla,
  DEFAULT_SLA,
  sourceClass,
  graceDays,
  promisedDate,
  expectedDate,
  slaStatus,
  computeItemSla,
} from "./sla-logic";

const D = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe("resolveSla", () => {
  it("returns defaults for empty/null", () => {
    expect(resolveSla()).toEqual(DEFAULT_SLA);
    expect(resolveSla(null)).toEqual(DEFAULT_SLA);
    expect(resolveSla({})).toEqual(DEFAULT_SLA);
  });
  it("merges partial overrides and rejects bad numbers", () => {
    const r = resolveSla({ xoonx: { fast: 15 }, riskWindowDays: -3 });
    expect(r.xoonx.fast).toBe(15);
    expect(r.xoonx.standard).toBe(30); // filled from default
    expect(r.egv).toEqual(DEFAULT_SLA.egv); // untouched
    expect(r.riskWindowDays).toBe(5); // negative rejected
  });
});

describe("sourceClass", () => {
  it("injection product wins over any supplier class", () => {
    expect(sourceClass("INJECTION", "FAST")).toBe("INJECTION");
    expect(sourceClass("injection", null)).toBe("INJECTION");
  });
  it("falls back to the supplier class, default STANDARD", () => {
    expect(sourceClass("SUPPLEMENT", "FAST")).toBe("FAST");
    expect(sourceClass("DEVICE", "STANDARD")).toBe("STANDARD");
    expect(sourceClass("DEVICE", null)).toBe("STANDARD");
    expect(sourceClass(null, "garbage")).toBe("STANDARD");
  });
});

describe("graceDays", () => {
  it("picks per scope + class", () => {
    expect(graceDays("EGV", "INJECTION", DEFAULT_SLA)).toBe(40);
    expect(graceDays("EGV", "STANDARD", DEFAULT_SLA)).toBe(30);
    expect(graceDays("EGV", "FAST", DEFAULT_SLA)).toBe(20);
  });
  it("uses the XOONX grace set for XOONX scope", () => {
    const sla = resolveSla({ xoonx: { injection: 50, standard: 35, fast: 25 } });
    expect(graceDays("XOONX", "INJECTION", sla)).toBe(50);
    expect(graceDays("EGV", "INJECTION", sla)).toBe(40); // egv unchanged
  });
});

describe("promised / expected dates", () => {
  it("promised = createdAt + grace", () => {
    expect(promisedDate(D("2026-01-01"), 30)).toEqual(D("2026-01-31"));
  });
  it("expected = trip date if present, else the promise", () => {
    const p = D("2026-02-01");
    expect(expectedDate(p, null)).toEqual(p);
    expect(expectedDate(p, D("2026-01-20"))).toEqual(D("2026-01-20"));
  });
});

describe("slaStatus", () => {
  const base = { riskWindowDays: 5 };
  it("delivered on time → DELIVERED, late → DELAYED", () => {
    expect(slaStatus({ ...base, promised: D("2026-02-01"), now: D("2026-02-10"), deliveredAt: D("2026-01-30") })).toBe("DELIVERED");
    expect(slaStatus({ ...base, promised: D("2026-02-01"), now: D("2026-02-10"), deliveredAt: D("2026-02-03") })).toBe("DELAYED");
  });
  it("overdue & undelivered → DELAYED", () => {
    expect(slaStatus({ ...base, promised: D("2026-02-01"), now: D("2026-02-02") })).toBe("DELAYED");
  });
  it("trip arriving after the promise → DELAYED", () => {
    expect(slaStatus({ ...base, promised: D("2026-02-01"), now: D("2026-01-10"), tripDeliveryAt: D("2026-02-05") })).toBe("DELAYED");
  });
  it("fresh order with runway and no trip → HEALTHY", () => {
    expect(slaStatus({ ...base, promised: D("2026-02-01"), now: D("2026-01-01") })).toBe("HEALTHY");
  });
  it("deadline within the risk window, no trip → RISK", () => {
    expect(slaStatus({ ...base, promised: D("2026-02-01"), now: D("2026-01-28") })).toBe("RISK"); // 4 days left
  });
  it("trip arrives with a tight margin → RISK", () => {
    expect(slaStatus({ ...base, promised: D("2026-02-01"), now: D("2026-01-01"), tripDeliveryAt: D("2026-01-29") })).toBe("RISK"); // 3-day margin
  });
  it("trip arrives with a comfortable margin → HEALTHY", () => {
    expect(slaStatus({ ...base, promised: D("2026-02-01"), now: D("2026-01-01"), tripDeliveryAt: D("2026-01-20") })).toBe("HEALTHY"); // 12-day margin
  });
});

describe("computeItemSla", () => {
  it("injection EGV: 40-day promise, healthy early, no trip", () => {
    const r = computeItemSla({
      scope: "EGV",
      productType: "INJECTION",
      supplierSlaClass: "FAST",
      createdAt: D("2026-01-01"),
      now: D("2026-01-05"),
      sla: DEFAULT_SLA,
    });
    expect(r.source).toBe("INJECTION");
    expect(r.grace).toBe(40);
    expect(r.promised).toEqual(D("2026-02-10"));
    expect(r.expected).toEqual(D("2026-02-10"));
    expect(r.status).toBe("HEALTHY");
  });
  it("prefers a stored promise snapshot over recomputing", () => {
    const r = computeItemSla({
      scope: "EGV",
      productType: "DEVICE",
      supplierSlaClass: "STANDARD",
      createdAt: D("2026-01-01"),
      promisedAt: D("2026-03-01"),
      now: D("2026-01-05"),
      sla: DEFAULT_SLA,
    });
    expect(r.promised).toEqual(D("2026-03-01"));
  });
  it("XOONX fast retailer + late trip → DELAYED", () => {
    const r = computeItemSla({
      scope: "XOONX",
      productType: "XOONX",
      supplierSlaClass: "FAST",
      createdAt: D("2026-01-01"),
      tripDeliveryAt: D("2026-01-25"),
      now: D("2026-01-10"),
      sla: DEFAULT_SLA,
    });
    expect(r.grace).toBe(20);
    expect(r.promised).toEqual(D("2026-01-21"));
    expect(r.status).toBe("DELAYED");
  });
});
