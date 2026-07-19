import { describe, it, expect } from "vitest";
import {
  requiresCustomer,
  allowsPhotos,
  requestScopes,
  primaryRequestModule,
  validateRequest,
  expectedDeposit,
  isRequestStatus,
  usesApprovalGate,
  hasSpawnedItems,
  requestLinesEditable,
  requestLineProductError,
} from "./request-logic";
import type { AccessLike } from "@/lib/products/products-logic";

const mk = (mods: string[], isAdmin = false): AccessLike => ({
  isAdmin,
  canModule: (k: string) => isAdmin || mods.includes(k),
  can: (k: string) => isAdmin || mods.includes(k),
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
  it("sales→VEEEY, xoonx→XOONX, admin→all", () => {
    expect(requestScopes(mk(["order_requests"]), "OPERATE")).toEqual(["VEEEY"]);
    expect(requestScopes(mk(["xoonx"]), "OPERATE")).toEqual(["XOONX"]);
    expect(requestScopes(mk(["purchasing"]), "OPERATE")).toEqual([]);
    expect(requestScopes(mk([], true), "OPERATE")).toEqual(["VEEEY", "XOONX", "PERSONAL"]);
  });
  it("primary module prefers sales then xoonx", () => {
    expect(primaryRequestModule(mk(["xoonx"]))).toBe("xoonx");
    expect(primaryRequestModule(mk(["order_requests", "xoonx"]))).toBe("order_requests");
  });
});

describe("validateRequest", () => {
  const line = [{ productId: 1, count: 2 }];
  it("requires type, scope and at least one line", () => {
    expect(validateRequest({ type: "BAD", scope: "VEEEY", lines: line })).toHaveProperty("type");
    expect(validateRequest({ type: "RESTOCK", scope: "X", lines: line })).toHaveProperty("scope");
    expect(validateRequest({ type: "RESTOCK", scope: "VEEEY", lines: [] })).toHaveProperty("lines");
    expect(validateRequest({ type: "RESTOCK", scope: "VEEEY", lines: line })).toEqual({});
  });
  it("special order needs a customer (id or new name)", () => {
    expect(validateRequest({ type: "SPECIAL_ORDER", scope: "VEEEY", lines: line })).toHaveProperty("customer");
    expect(validateRequest({ type: "SPECIAL_ORDER", scope: "VEEEY", customerId: 5, lines: line })).toEqual({});
    expect(validateRequest({ type: "SPECIAL_ORDER", scope: "VEEEY", newCustomerName: "Ada", lines: line })).toEqual({});
  });
});

describe("expectedDeposit", () => {
  const lines = [{ count: 2, sellingPrice: 100 }, { count: 1, sellingPrice: 50 }]; // total 250
  it("is the pct of total selling value, rounded to whole EGP", () => {
    expect(expectedDeposit(25, lines)).toBe(63); // 62.5 → 63
    expect(expectedDeposit(100, lines)).toBe(250);
    expect(expectedDeposit(0, lines)).toBe(0);
  });
  it("treats a missing selling price as zero", () => {
    expect(expectedDeposit(50, [{ count: 3, sellingPrice: null }])).toBe(0);
  });
});

describe("approval gate", () => {
  it("recognises valid statuses", () => {
    expect(isRequestStatus("PENDING")).toBe(true);
    expect(isRequestStatus("APPROVED")).toBe(true);
    expect(isRequestStatus("REJECTED")).toBe(true);
    expect(isRequestStatus("NEW")).toBe(false);
    expect(isRequestStatus(null)).toBe(false);
  });
  it("gates VEEEY but not XOONX", () => {
    expect(usesApprovalGate("VEEEY")).toBe(true);
    expect(usesApprovalGate("XOONX")).toBe(false);
    expect(usesApprovalGate("PERSONAL")).toBe(false);
  });
  it("only APPROVED requests have spawned items", () => {
    expect(hasSpawnedItems("APPROVED")).toBe(true);
    expect(hasSpawnedItems("PENDING")).toBe(false);
    expect(hasSpawnedItems("REJECTED")).toBe(false);
  });
  it("lines editable only while items are all still REQUESTED (or none)", () => {
    expect(requestLinesEditable([])).toBe(true); // pending/rejected → no items
    expect(requestLinesEditable(["REQUESTED", "REQUESTED"])).toBe(true);
    expect(requestLinesEditable(["REQUESTED", "PURCHASED"])).toBe(false);
    expect(requestLinesEditable(["SHIPPED"])).toBe(false);
  });
});

describe("requestLineProductError", () => {
  const p = (name: string, scope: string, type: string) => ({ name, scope, type });
  it("accepts in-scope products; XOONX additionally requires the XOONX type", () => {
    expect(requestLineProductError("VEEEY", [p("Zinc", "VEEEY", "SUPPLEMENT"), p("Pump", "VEEEY", "DEVICE")])).toBeNull();
    expect(requestLineProductError("XOONX", [p("iPhone", "XOONX", "XOONX")])).toBeNull();
    expect(requestLineProductError("XOONX", [])).toBeNull();
  });
  it("rejects out-of-scope products", () => {
    expect(requestLineProductError("VEEEY", [p("iPhone", "XOONX", "XOONX")])).toContain("iPhone");
    expect(requestLineProductError("XOONX", [p("Zinc", "VEEEY", "SUPPLEMENT")])).toContain("Zinc");
  });
  it("rejects non-XOONX-type products in XOONX requests", () => {
    expect(requestLineProductError("XOONX", [p("iPhone", "XOONX", "XOONX"), p("Zinc D", "XOONX", "SUPPLEMENT")])).toContain("Zinc D");
    // VEEEY doesn't care about type
    expect(requestLineProductError("VEEEY", [p("Odd", "VEEEY", "XOONX")])).toBeNull();
  });
});
