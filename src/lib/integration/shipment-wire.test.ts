import { describe, it, expect } from "vitest";
import { buildShipmentWire, unitsMissingExpiry, type ShipmentUnit } from "./shipment-wire";

const AT = new Date("2026-07-21T12:00:00.000Z");
const SH = { id: 7, uid: "SHP2607001" };

const unit = (o: Partial<ShipmentUnit> = {}): ShipmentUnit => ({
  productId: 1, sku: "VEY-CEN-00914", veeeyWpId: 914, productName: "Centrum",
  expiryDate: new Date("2027-03-31T00:00:00.000Z"), lotCode: "L1",
  purchasePrice: 10, purchaseCurrency: null,
  ...o,
});

describe("buildShipmentWire", () => {
  it("counts identical units into one lot", () => {
    const w = buildShipmentWire(SH, [unit(), unit(), unit()], [], AT);
    expect(w.lines).toHaveLength(1);
    expect(w.lines[0].sku).toBe("VEY-CEN-00914");
    expect(w.lines[0].lots).toEqual([
      { expiryDate: "2027-03-31", lotCode: "L1", quantity: 3, unitCost: 10, currency: null },
    ]);
  });

  it("splits units of one product by differing expiry — the whole point of per-unit expiry", () => {
    const w = buildShipmentWire(SH, [
      unit(),
      unit({ expiryDate: new Date("2028-01-31T00:00:00.000Z") }),
      unit({ expiryDate: new Date("2028-01-31T00:00:00.000Z") }),
    ], [], AT);
    expect(w.lines[0].lots.map((l) => [l.expiryDate, l.quantity])).toEqual([
      ["2027-03-31", 1],
      ["2028-01-31", 2],
    ]);
  });

  it("keeps differing costs separate rather than averaging them away", () => {
    const w = buildShipmentWire(SH, [unit({ purchasePrice: 10 }), unit({ purchasePrice: 12 })], [], AT);
    expect(w.lines[0].lots).toHaveLength(2);
    expect(w.lines[0].lots.map((l) => l.unitCost).sort()).toEqual([10, 12]);
  });

  it("carries the raw cost + currency — Veeey converts and pins the FX rate at approval", () => {
    const w = buildShipmentWire(SH, [unit({ purchasePrice: 4.5, purchaseCurrency: "usd" })], [], AT);
    expect(w.lines[0].lots[0]).toMatchObject({ unitCost: 4.5, currency: "USD" });
  });

  it("a unit with no expiry is a real lot (devices), not dropped", () => {
    const w = buildShipmentWire(SH, [unit({ expiryDate: null, lotCode: null })], [], AT);
    expect(w.lines[0].lots).toEqual([
      { expiryDate: null, lotCode: null, quantity: 1, unitCost: 10, currency: null },
    ]);
  });

  it("groups several products and sorts deterministically (a re-fire must look like a retry)", () => {
    const units = [
      unit({ productId: 2, productName: "Zinc", sku: "VEY-ZN-1", veeeyWpId: 2 }),
      unit(),
      unit({ productId: 2, productName: "Zinc", sku: "VEY-ZN-1", veeeyWpId: 2 }),
    ];
    const a = buildShipmentWire(SH, units, ["as1"], AT);
    const b = buildShipmentWire(SH, [...units].reverse(), ["as1"], AT);
    expect(a.lines.map((l) => l.productName)).toEqual(["Centrum", "Zinc"]);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b)); // order-independent output
  });

  it("carries shipment identity and photo asset ids", () => {
    const w = buildShipmentWire(SH, [unit()], ["a1", "a2"], AT);
    expect(w).toMatchObject({ shipmentUid: "SHP2607001", shipmentId: 7, receivedAt: AT.toISOString(), photoAssetIds: ["a1", "a2"] });
  });

  it("counts units still missing an expiry", () => {
    expect(unitsMissingExpiry([unit(), unit({ expiryDate: null }), unit({ expiryDate: null })])).toBe(2);
  });
});
