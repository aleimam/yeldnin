import { describe, it, expect } from "vitest";
import { parseProductWireV2, resolveSyncedType } from "./product-wire";

describe("parseProductWireV2", () => {
  const base = { sku: "120057", name: "Vitamin D3", type: "SUPPLEMENT" };

  it("accepts a valid product and normalizes optionals", () => {
    const w = parseProductWireV2({ ...base, legacyWpId: 120057, size: "120 caps", grade: "A", photoUrls: ["https://veeey.com/a.webp"], archived: false });
    expect(w).toEqual({ sku: "120057", legacyWpId: 120057, name: "Vitamin D3", type: "SUPPLEMENT", size: "120 caps", grade: "A", photoUrls: ["https://veeey.com/a.webp"], archived: false });
  });

  it("rejects missing sku / name and unknown or heavy types", () => {
    expect(parseProductWireV2({ ...base, sku: "" })).toBeNull();
    expect(parseProductWireV2({ ...base, name: "  " })).toBeNull();
    expect(parseProductWireV2({ ...base, type: "WIDGET" })).toBeNull();
    expect(parseProductWireV2({ ...base, type: "HEAVY_SUPPLEMENT" })).toBeNull(); // heavy is YeldnIN-only
    expect(parseProductWireV2(null)).toBeNull();
  });

  it("keeps only absolute http(s) photo urls, capped at 6", () => {
    const urls = ["https://a", "http://b", "/rel", "ftp://c", "https://d", "https://e", "https://f", "https://g", "https://h"];
    const w = parseProductWireV2({ ...base, photoUrls: urls });
    expect(w!.photoUrls).toEqual(["https://a", "http://b", "https://d", "https://e", "https://f", "https://g"]);
  });

  it("legacyWpId must be an integer or null", () => {
    expect(parseProductWireV2({ ...base, legacyWpId: "120057" })!.legacyWpId).toBeNull();
    expect(parseProductWireV2({ ...base, legacyWpId: 12.5 })!.legacyWpId).toBeNull();
  });
});

describe("resolveSyncedType (heavy never downgrades)", () => {
  it("keeps HEAVY_SUPPLEMENT when Veeey sends SUPPLEMENT", () => {
    expect(resolveSyncedType("SUPPLEMENT", "HEAVY_SUPPLEMENT")).toBe("HEAVY_SUPPLEMENT");
  });
  it("otherwise takes the incoming base", () => {
    expect(resolveSyncedType("DEVICE", "HEAVY_SUPPLEMENT")).toBe("DEVICE"); // real base change
    expect(resolveSyncedType("SUPPLEMENT", "SUPPLEMENT")).toBe("SUPPLEMENT");
    expect(resolveSyncedType("INJECTION", null)).toBe("INJECTION"); // new product
  });
});
