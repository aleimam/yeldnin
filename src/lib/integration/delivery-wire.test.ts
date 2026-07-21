import { describe, it, expect } from "vitest";
import { parseDeliveryCreated, parseDeliveryCancel, isStoreKey, STORE_KEYS, buildTrackingWire, type TrackingSource } from "./delivery-wire";

const good = {
  storeKey: "veeey.net",
  orderNumber: "V-10432",
  placedAt: "2026-07-20T09:12:00Z",
  customer: { name: "Ada Lovelace", phone: "+201001234567", altPhone: "+201009998877" },
  address: { zone: "Nasr City", subArea: "1st District", text: "12 Ahmed Fakhry St, flat 4", mapUrl: "https://maps.example/x" },
  lines: [
    { sku: "VEY-1", name: "Vitamin D3", qty: 2 },
    { sku: null, name: "Free sample", qty: 1 },
  ],
  collectAmountEgp: 145000,
  paymentMethod: "COD",
  promisedDate: "2026-07-21",
  promisedSlot: "14:00-18:00",
  notes: "Call before arriving",
};

describe("isStoreKey", () => {
  it("accepts only the two VEEEY stores", () => {
    expect(STORE_KEYS).toEqual(["veeey.net", "veeey.com"]);
    expect(isStoreKey("veeey.net")).toBe(true);
    expect(isStoreKey("veeey.com")).toBe(true);
    expect(isStoreKey("egyptvitamins.net")).toBe(false); // the retiring legacy store
    expect(isStoreKey("")).toBe(false);
  });
});

describe("parseDeliveryCreated", () => {
  it("maps a full payload", () => {
    const r = parseDeliveryCreated(good);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.orderNumber).toBe("V-10432");
    expect(r.value.customerName).toBe("Ada Lovelace");
    expect(r.value.addressText).toContain("Ahmed Fakhry");
    expect(r.value.collectPiastres).toBe(145000);
    expect(r.value.lines).toHaveLength(2);
    expect(r.value.promisedSlot).toBe("14:00-18:00");
  });

  it("rejects with a SPECIFIC code per missing field", () => {
    expect(parseDeliveryCreated({ ...good, storeKey: "nope" })).toEqual({ ok: false, code: "unknown_store" });
    expect(parseDeliveryCreated({ ...good, orderNumber: "" })).toEqual({ ok: false, code: "missing_order_number" });
    expect(parseDeliveryCreated({ ...good, customer: {} })).toEqual({ ok: false, code: "missing_customer" });
    expect(parseDeliveryCreated({ ...good, address: { zone: "x" } })).toEqual({ ok: false, code: "missing_address" });
    expect(parseDeliveryCreated(null)).toEqual({ ok: false, code: "validation_failed" });
  });

  it("defaults payment to COD and drops malformed lines", () => {
    const r = parseDeliveryCreated({ ...good, paymentMethod: undefined, lines: [{ name: "keep", qty: 3 }, { qty: 9 }, "junk"] });
    expect(r.ok && r.value.paymentMethod).toBe("COD");
    expect(r.ok && r.value.lines).toEqual([{ sku: null, name: "keep", qty: 3 }]);
  });

  it("pins a PREPAID order to zero-collect, even if an amount was sent", () => {
    // Belt-and-braces: a positive collect on a prepaid order is contradictory,
    // and trusting it would tell a courier to collect money already paid.
    const r = parseDeliveryCreated({ ...good, paymentMethod: "PREPAID", collectAmountEgp: 145000 });
    expect(r.ok && r.value.collectPiastres).toBe(0);
  });

  it("rejects a non-integer or negative collect amount rather than rounding", () => {
    expect(parseDeliveryCreated({ ...good, collectAmountEgp: 145000.5 })).toMatchObject({ ok: true }); // falls back to 0, not a crash
    const r1 = parseDeliveryCreated({ ...good, collectAmountEgp: 145000.5 });
    expect(r1.ok && r1.value.collectPiastres).toBe(0);
    const r2 = parseDeliveryCreated({ ...good, collectAmountEgp: -5 });
    expect(r2.ok && r2.value.collectPiastres).toBe(0);
  });

  it("ignores an unknown promised slot", () => {
    const r = parseDeliveryCreated({ ...good, promisedSlot: "13:00-15:00" });
    expect(r.ok && r.value.promisedSlot).toBeNull();
  });
});

describe("parseDeliveryCancel", () => {
  it("needs a known store and an order number", () => {
    expect(parseDeliveryCancel({ storeKey: "veeey.net", orderNumber: "V-10432", reason: "customer_cancelled" })).toEqual({
      ok: true,
      value: { storeKey: "veeey.net", orderNumber: "V-10432", reason: "customer_cancelled" },
    });
    expect(parseDeliveryCancel({ storeKey: "x", orderNumber: "V-1" })).toEqual({ ok: false, code: "unknown_store" });
    expect(parseDeliveryCancel({ storeKey: "veeey.net" })).toEqual({ ok: false, code: "missing_order_number" });
  });
});

describe("buildTrackingWire", () => {
  const base: TrackingSource = {
    uid: "DLV2607001",
    storeKey: "veeey.net",
    orderNumber: "V-10432",
    scope: "VEEEY",
    status: "OUT_FOR_DELIVERY",
    failureReason: null,
    collectedPiastres: null,
    reviewFlag: false,
    courierNote: null,
    reviewNote: null,
    promisedDate: new Date("2026-07-22T00:00:00Z"),
    promisedSlot: "18:00-22:00",
    courierName: "Mahmoud A.",
    photoUrl: null,
  };
  const at = new Date("2026-07-20T15:40:00Z");

  it("carries identity, the change time, and the promise as YYYY-MM-DD", () => {
    const w = buildTrackingWire(base, at);
    expect(w).toMatchObject({ storeKey: "veeey.net", orderNumber: "V-10432", deliveryUid: "DLV2607001", status: "OUT_FOR_DELIVERY" });
    expect(w.at).toBe("2026-07-20T15:40:00.000Z"); // when it HAPPENED
    expect(w.promisedDate).toBe("2026-07-22"); // date only
    expect(w.courierName).toBe("Mahmoud A.");
  });

  it("emits the failure reason ONLY on FAILED", () => {
    expect(buildTrackingWire({ ...base, status: "FAILED", failureReason: "NOT_HOME" }, at).reason).toBe("NOT_HOME");
    // a reason lingering on the row must not ride along on a non-failure status
    expect(buildTrackingWire({ ...base, status: "OUT_FOR_DELIVERY", failureReason: "NOT_HOME" }, at).reason).toBeNull();
  });

  it("emits collectedAmountEgp (piastres) ONLY on DELIVERED", () => {
    expect(buildTrackingWire({ ...base, status: "DELIVERED", collectedPiastres: 145000 }, at).collectedAmountEgp).toBe(145000);
    expect(buildTrackingWire({ ...base, status: "RESCHEDULED", collectedPiastres: 145000 }, at).collectedAmountEgp).toBeNull();
  });

  it("prefers the courier's note over an Ops flag note", () => {
    expect(buildTrackingWire({ ...base, courierNote: "took 3 of 5", reviewNote: "flagged" }, at).note).toBe("took 3 of 5");
    expect(buildTrackingWire({ ...base, courierNote: null, reviewNote: "flagged" }, at).note).toBe("flagged");
    expect(buildTrackingWire({ ...base, reviewFlag: true }, at).reviewFlag).toBe(true);
  });

  it("carries a null promise cleanly", () => {
    const w = buildTrackingWire({ ...base, promisedDate: null, promisedSlot: null }, at);
    expect(w.promisedDate).toBeNull();
    expect(w.promisedSlot).toBeNull();
  });
});
