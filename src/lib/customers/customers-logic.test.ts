import { describe, it, expect } from "vitest";
import { customerScopes, primaryCustomerModule, moduleForCustomerScope } from "./customers-logic";

const acc = (mods: Record<string, boolean>, isAdmin = false) => ({
  isAdmin,
  canModule: (m: string) => !!mods[m],
  can: (m: string) => !!mods[m],
});

describe("customerScopes", () => {
  it("admin sees both EGV and XOONX", () => {
    expect(customerScopes(acc({}, true), "VIEW")).toEqual(["EGV", "XOONX"]);
  });
  it("Sales access → EGV only", () => {
    expect(customerScopes(acc({ order_requests: true }), "VIEW")).toEqual(["EGV"]);
  });
  it("XOONX access → XOONX only", () => {
    expect(customerScopes(acc({ xoonx: true }), "VIEW")).toEqual(["XOONX"]);
  });
  it("both modules → both scopes", () => {
    expect(customerScopes(acc({ order_requests: true, xoonx: true }), "VIEW")).toEqual(["EGV", "XOONX"]);
  });
  it("no access → empty (no customers visible)", () => {
    expect(customerScopes(acc({}), "VIEW")).toEqual([]);
  });
});

describe("primaryCustomerModule / moduleForCustomerScope", () => {
  it("XOONX-only user gets the xoonx shell", () => {
    expect(primaryCustomerModule(acc({ xoonx: true }))).toBe("xoonx");
  });
  it("Sales (or dual) user gets the order_requests shell", () => {
    expect(primaryCustomerModule(acc({ order_requests: true }))).toBe("order_requests");
    expect(primaryCustomerModule(acc({ order_requests: true, xoonx: true }))).toBe("order_requests");
  });
  it("maps a scope to its owning module", () => {
    expect(moduleForCustomerScope("XOONX")).toBe("xoonx");
    expect(moduleForCustomerScope("EGV")).toBe("order_requests");
  });
});
