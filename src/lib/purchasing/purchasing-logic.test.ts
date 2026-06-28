import { describe, it, expect } from "vitest";
import {
  validatePurchase,
  clampLinesToPool,
  nextPurchaseStatus,
  prevPurchaseStatus,
  purchaseCascadeCount,
  isMovableFlag,
  PURCHASE_ITEM_STATUS,
} from "./purchasing-logic";

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

describe("purchase status stepping", () => {
  it("walks forward and back, bounded at the ends", () => {
    expect(nextPurchaseStatus("NEW")).toBe("DISPATCHED");
    expect(nextPurchaseStatus("RECEIVED")).toBeNull();
    expect(prevPurchaseStatus("RECEIVED")).toBe("DELIVERED");
    expect(prevPurchaseStatus("NEW")).toBeNull();
    expect(prevPurchaseStatus("DISPATCHED")).toBe("NEW");
  });
  it("maps each purchase status to its item-status boundary", () => {
    expect(PURCHASE_ITEM_STATUS.NEW).toBe("ORDERED");
    expect(PURCHASE_ITEM_STATUS.DISPATCHED).toBe("SHIPPED");
    expect(PURCHASE_ITEM_STATUS.DELIVERED).toBe("DELIVERED");
    expect(PURCHASE_ITEM_STATUS.RECEIVED).toBe("HUB");
  });
});

describe("isMovableFlag", () => {
  it("only un-flagged units follow their container", () => {
    expect(isMovableFlag(null)).toBe(true);
    expect(isMovableFlag(undefined)).toBe(true);
    expect(isMovableFlag("LOST")).toBe(false);
    expect(isMovableFlag("DELAYED")).toBe(false);
  });
});

describe("purchaseCascadeCount", () => {
  const items = [
    { status: "HUB", exceptionFlag: null }, // received, would move on a RECEIVED step
    { status: "HUB", exceptionFlag: "LOST" }, // pinned — never counts
    { status: "TRANSIT", exceptionFlag: null }, // already past the hub
    { status: "SHIPPED", exceptionFlag: null },
  ];
  it("counts un-pinned units at the current status's item-boundary", () => {
    expect(purchaseCascadeCount(items, "RECEIVED")).toBe(1); // only the un-flagged HUB unit
    expect(purchaseCascadeCount(items, "DISPATCHED")).toBe(1); // the SHIPPED unit
    expect(purchaseCascadeCount(items, "DELIVERED")).toBe(0); // none at DELIVERED
  });
  it("excludes units already past the hub on a backward (RECEIVED) step", () => {
    // The TRANSIT unit is past HUB, so it is left untouched and never counted.
    expect(purchaseCascadeCount(items, "RECEIVED")).toBe(1);
  });
});
