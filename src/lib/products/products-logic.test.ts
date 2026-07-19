import { describe, it, expect } from "vitest";
import { productScopes, primaryProductModule, validateProduct, canSeeSellingPrice, canSeePurchasePrice, type AccessLike } from "./products-logic";

const mk = (mods: string[], isAdmin = false): AccessLike => ({
  isAdmin,
  canModule: (k: string) => isAdmin || mods.includes(k),
  can: (k: string) => isAdmin || mods.includes(k),
});

describe("productScopes", () => {
  it("admins get every scope incl. PERSONAL", () => {
    expect(productScopes(mk([], true), "OPERATE")).toEqual(["VEEEY", "XOONX", "PERSONAL"]);
  });
  it("purchasing gets VEEEY + XOONX (no PERSONAL)", () => {
    expect(productScopes(mk(["purchasing"]), "OPERATE")).toEqual(["VEEEY", "XOONX"]);
  });
  it("sales gets VEEEY only", () => {
    expect(productScopes(mk(["order_requests"]), "OPERATE")).toEqual(["VEEEY"]);
  });
  it("xoonx gets XOONX only", () => {
    expect(productScopes(mk(["xoonx"]), "OPERATE")).toEqual(["XOONX"]);
  });
  it("no relevant access → no scopes", () => {
    expect(productScopes(mk(["expenses"]), "OPERATE")).toEqual([]);
  });
});

describe("primaryProductModule", () => {
  it("purchasing folds into logistics; else sales, then xoonx", () => {
    expect(primaryProductModule(mk(["purchasing", "xoonx"]))).toBe("logistics");
    expect(primaryProductModule(mk(["order_requests"]))).toBe("order_requests");
    expect(primaryProductModule(mk(["xoonx"]))).toBe("xoonx");
  });
});

describe("validateProduct", () => {
  it("requires name + valid scope + valid type", () => {
    expect(validateProduct({ name: "", scope: "VEEEY", type: "SUPPLEMENT" })).toHaveProperty("name");
    expect(validateProduct({ name: "X", scope: "BAD", type: "SUPPLEMENT" })).toHaveProperty("scope");
    expect(validateProduct({ name: "X", scope: "VEEEY", type: "BAD" })).toHaveProperty("type");
    expect(validateProduct({ name: "X", scope: "VEEEY", type: "SUPPLEMENT" })).toEqual({});
  });
});

describe("price visibility (golden rule)", () => {
  it("selling price: Sales/XOONX/admin — not Purchasing/Logistics", () => {
    expect(canSeeSellingPrice(mk(["order_requests"]))).toBe(true);
    expect(canSeeSellingPrice(mk(["xoonx"]))).toBe(true);
    expect(canSeeSellingPrice(mk(["purchasing"]))).toBe(false);
    expect(canSeeSellingPrice(mk(["logistics"]))).toBe(false);
    expect(canSeeSellingPrice(mk([], true))).toBe(true);
  });
  it("purchase price: everyone EXCEPT VEEEY Sales — the golden rule", () => {
    // VEEEY Sales is the sell side and must never see the buy cost.
    expect(canSeePurchasePrice(mk(["order_requests"]))).toBe(false);
    // XOONX sources/pays for its own items — buy price is its own cost basis.
    expect(canSeePurchasePrice(mk(["xoonx"]))).toBe(true);
    // Purchasing/Logistics are the buy-side back office.
    expect(canSeePurchasePrice(mk(["purchasing"]))).toBe(true);
    expect(canSeePurchasePrice(mk(["logistics"]))).toBe(true);
    expect(canSeePurchasePrice(mk([], true))).toBe(true);
  });
});
