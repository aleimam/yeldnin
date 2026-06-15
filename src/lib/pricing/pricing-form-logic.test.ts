import { describe, it, expect } from "vitest";
import { parseSupplementForm, parseDeviceForm } from "./pricing-form-logic";

describe("parseSupplementForm", () => {
  const valid = {
    importedFrom: "USA",
    purchasePrice: "23",
    count: "60",
    dailyDose: "1",
    weight: "140",
    shape: "Capsules/Tablets",
    packaging: "Plastic",
    size: "Normal",
    maleSupport: "on",
  };

  it("parses a valid form", () => {
    const r = parseSupplementForm(valid);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.input.purchasePrice).toBe(23);
      expect(r.input.maleSupport).toBe(true);
    }
  });

  it("flags missing/invalid numeric + select fields", () => {
    const r = parseSupplementForm({ ...valid, purchasePrice: "", count: "-5", shape: "Bogus" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.fieldErrors.purchasePrice).toBeTruthy();
      expect(r.fieldErrors.count).toBeTruthy();
      expect(r.fieldErrors.shape).toBeTruthy();
    }
  });
});

describe("parseDeviceForm", () => {
  it("requires positive dimensions", () => {
    const r = parseDeviceForm({
      importedFrom: "UK",
      purchasePrice: "1200",
      lengthCm: "15",
      widthCm: "0",
      heightCm: "15",
      weightKg: "1.5",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors.widthCm).toBeTruthy();
  });
});
