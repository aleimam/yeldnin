import { describe, it, expect } from "vitest";
import { normalizeImportRow } from "./products-import-logic";

describe("normalizeImportRow", () => {
  it("maps a row with varied, case-insensitive headers", () => {
    const r = normalizeImportRow({ Name: "Creatine", Type: "supplement", SKU: "CR-1", "Weight (g)": "300", Notes: "bulk" }, "VEEEY");
    expect(r).toMatchObject({ name: "Creatine", type: "SUPPLEMENT", sku: "CR-1", weightG: 300, notes: "bulk" });
  });
  it("returns null when there's no name", () => {
    expect(normalizeImportRow({ sku: "X" }, "VEEEY")).toBeNull();
  });
  it("defaults type by scope when missing or invalid", () => {
    expect(normalizeImportRow({ name: "A" }, "XOONX")!.type).toBe("XOONX");
    expect(normalizeImportRow({ name: "A", type: "junk" }, "VEEEY")!.type).toBe("SUPPLEMENT");
  });
  it("leaves weight null when not numeric", () => {
    expect(normalizeImportRow({ name: "A", weight: "n/a" }, "VEEEY")!.weightG).toBeNull();
  });
});
