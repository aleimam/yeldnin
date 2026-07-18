import { describe, it, expect } from "vitest";
import { parseProductWire } from "./catalog-wire";

const wire = { wpId: 120057, sku: "GEN-000123", name: "Vitamin D3 5000IU", type: "SUPPLEMENT", active: true };

describe("parseProductWire", () => {
  it("accepts a well-formed wire product unchanged (round-trips over JSON)", () => {
    const parsed = parseProductWire(JSON.parse(JSON.stringify(wire)));
    expect(parsed).toEqual(wire);
  });

  it("rejects a missing/non-integer wpId or a missing name", () => {
    expect(parseProductWire({ sku: "X", name: "No wpId", type: "SUPPLEMENT", active: true })).toBeNull();
    expect(parseProductWire({ wpId: 12.5, name: "Float wpId" })).toBeNull();
    expect(parseProductWire({ wpId: 120057, type: "SUPPLEMENT", active: true })).toBeNull();
    expect(parseProductWire({ wpId: 120057, name: "   " })).toBeNull();
    expect(parseProductWire(null)).toBeNull();
  });

  it("tolerates an absent sku/type and coerces active to a boolean", () => {
    expect(parseProductWire({ wpId: 120057, name: "Bare" })).toEqual({
      wpId: 120057,
      sku: null,
      name: "Bare",
      type: "",
      active: false,
    });
  });
});
