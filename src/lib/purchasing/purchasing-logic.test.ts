import { describe, it, expect } from "vitest";
import { validatePurchase, clampLinesToPool } from "./purchasing-logic";

describe("validatePurchase", () => {
  const line = [{ productId: 1, count: 2 }];
  it("requires scope, a destination and at least one line", () => {
    expect(validatePurchase({ scope: "BAD", destinationType: "HUB", destinationId: 1, lines: line })).toHaveProperty("scope");
    expect(validatePurchase({ scope: "EGV", destinationType: "WAT", destinationId: 1, lines: line })).toHaveProperty("destinationType");
    expect(validatePurchase({ scope: "EGV", destinationType: "HUB", destinationId: null, lines: line })).toHaveProperty("destination");
    expect(validatePurchase({ scope: "EGV", destinationType: "HUB", destinationId: 1, lines: [] })).toHaveProperty("lines");
    expect(validatePurchase({ scope: "EGV", destinationType: "HUB", destinationId: 1, lines: line })).toEqual({});
  });
});

describe("clampLinesToPool", () => {
  it("caps each line to available stock and drops empties", () => {
    const avail = new Map([[1, 3], [2, 0]]);
    expect(clampLinesToPool([{ productId: 1, count: 5 }, { productId: 2, count: 1 }, { productId: 3, count: 2 }], avail)).toEqual([
      { productId: 1, count: 3 },
    ]);
  });
});
