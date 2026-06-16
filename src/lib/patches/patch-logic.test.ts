import { describe, it, expect } from "vitest";
import { nextPatchStatus, PATCH_TO_ITEM_STATUS, validatePatch } from "./patch-logic";

describe("patch status flow", () => {
  it("advances DISPATCHED → DELIVERED → RECEIVED", () => {
    expect(nextPatchStatus("DISPATCHED")).toBe("DELIVERED");
    expect(nextPatchStatus("DELIVERED")).toBe("RECEIVED");
    expect(nextPatchStatus("RECEIVED")).toBeNull();
  });
  it("maps each patch status to the item status it drives", () => {
    expect(PATCH_TO_ITEM_STATUS.DISPATCHED).toBe("SHIPPED");
    expect(PATCH_TO_ITEM_STATUS.DELIVERED).toBe("DELIVERED");
    expect(PATCH_TO_ITEM_STATUS.RECEIVED).toBe("HUB");
  });
});

describe("validatePatch", () => {
  it("needs a purchase and at least one item", () => {
    expect(validatePatch({ purchaseId: null, itemIds: [1] })).toHaveProperty("purchase");
    expect(validatePatch({ purchaseId: 1, itemIds: [] })).toHaveProperty("items");
    expect(validatePatch({ purchaseId: 1, itemIds: [1, 2] })).toEqual({});
  });
});
