import { describe, it, expect } from "vitest";
import {
  computeSupplementPrice,
  computeDevicePrice,
  dosageTier,
  type SupplementInput,
  type DeviceInput,
} from "./pricing-logic";

// Fixtures taken directly from the Excel workbook (Pricing.xlsx) so the engine
// is a faithful reproduction of the sheet the business already uses.

describe("dosageTier", () => {
  it("matches Excel banding and guards divide-by-zero", () => {
    expect(dosageTier(90, 1)).toBe(1); // 90 days
    expect(dosageTier(60, 1)).toBe(2); // 60 days
    expect(dosageTier(10, 1)).toBe(3); // 10 days
    expect(dosageTier(60, 0)).toBe(1); // dailyDose 0 => 1
    expect(dosageTier(0, 1)).toBe(1); // count 0 => 1
  });
});

describe("computeSupplementPrice — Excel parity", () => {
  it("Vitamins 1 sheet => 3580", () => {
    const input: SupplementInput = {
      importedFrom: "USA",
      purchasePrice: 23,
      count: 60,
      dailyDose: 1,
      weight: 140,
      shape: "Capsules/Tablets",
      packaging: "Plastic",
      size: "Normal",
      maleSupport: false,
    };
    expect(computeSupplementPrice(input).price).toBe(3580);
  });

  it("Vitamins 2 sheet (Injection, Glass) => 10610", () => {
    const input: SupplementInput = {
      importedFrom: "USA",
      purchasePrice: 60,
      count: 10,
      dailyDose: 1,
      weight: 12,
      shape: "Injection",
      packaging: "Glass",
      size: "Normal",
      maleSupport: false,
    };
    expect(computeSupplementPrice(input).price).toBe(10610);
  });

  it("X sheet => 30740", () => {
    const input: SupplementInput = {
      importedFrom: "USA",
      purchasePrice: 320,
      count: 60,
      dailyDose: 1,
      weight: 200,
      shape: "Capsules/Tablets",
      packaging: "Plastic",
      size: "Normal",
      maleSupport: false,
    };
    expect(computeSupplementPrice(input).price).toBe(30740);
  });
});

describe("computeDevicePrice — Excel parity", () => {
  it("Devices 1 sheet => ~109166.52", () => {
    const input: DeviceInput = {
      importedFrom: "USA",
      purchasePrice: 1200,
      lengthCm: 15,
      widthCm: 15,
      heightCm: 15,
      weightKg: 1.5,
      maleSupport: false,
    };
    const { price, chargeableWeight } = computeDevicePrice(input);
    expect(chargeableWeight).toBeCloseTo(1.5, 5); // max(0.675, 1.5)
    // internal*1.15 = 109166.5201, rounded UP to the nearest 10:
    expect(price).toBe(109170);
  });
});
