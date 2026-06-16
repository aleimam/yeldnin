import { describe, it, expect } from "vitest";
import {
  requiresCustomer,
  allowsPhotos,
  requestScopes,
  primaryRequestModule,
  validateRequest,
} from "./request-logic";
import type { AccessLike } from "@/lib/products/products-logic";

const mk = (mods: string[], isAdmin = false): AccessLike => ({
  isAdmin,
  canModule: (k: string) => isAdmin || mods.includes(k),
});

describe("request type rules", () => {
  it("only special orders need a customer / allow photos", () => {
    expect(requiresCustomer("SPECIAL_ORDER")).toBe(true);
    expect(requiresCustomer("RESTOCK")).toBe(false);
    expect(allowsPhotos("SPECIAL_ORDER")).toBe(true);
    expect(allowsPhotos("OPTIONAL")).toBe(false);
  });
});

describe("requestScopes (no purchasing)", () => {
  it("sales→EGV, xoonx→XOONX, admin→all", () => {
    expect(requestScopes(mk(["order_requests"]), "OPERATE")).toEqual(["EGV"]);
    expect(requestScopes(mk(["xoonx"]), "OPERATE")).toEqual(["XOONX"]);
    expect(requestScopes(mk(["purchasing"]), "OPERATE")).toEqual([]);
    expect(requestScopes(mk([], true), "OPERATE")).toEqual(["EGV", "XOONX", "PERSONAL"]);
  });
  it("primary module prefers sales then xoonx", () => {
    expect(primaryRequestModule(mk(["xoonx"]))).toBe("xoonx");
    expect(primaryRequestModule(mk(["order_requests", "xoonx"]))).toBe("order_requests");
  });
});

describe("validateRequest", () => {
  const line = [{ productId: 1, count: 2 }];
  it("requires type, scope and at least one line", () => {
    expect(validateRequest({ type: "BAD", scope: "EGV", lines: line })).toHaveProperty("type");
    expect(validateRequest({ type: "RESTOCK", scope: "X", lines: line })).toHaveProperty("scope");
    expect(validateRequest({ type: "RESTOCK", scope: "EGV", lines: [] })).toHaveProperty("lines");
    expect(validateRequest({ type: "RESTOCK", scope: "EGV", lines: line })).toEqual({});
  });
  it("special order needs a customer (id or new name)", () => {
    expect(validateRequest({ type: "SPECIAL_ORDER", scope: "EGV", lines: line })).toHaveProperty("customer");
    expect(validateRequest({ type: "SPECIAL_ORDER", scope: "EGV", customerId: 5, lines: line })).toEqual({});
    expect(validateRequest({ type: "SPECIAL_ORDER", scope: "EGV", newCustomerName: "Ada", lines: line })).toEqual({});
  });
});
