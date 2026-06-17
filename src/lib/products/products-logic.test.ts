import { describe, it, expect } from "vitest";
import { productScopes, primaryProductModule, validateProduct, type AccessLike } from "./products-logic";

const mk = (mods: string[], isAdmin = false): AccessLike => ({
  isAdmin,
  canModule: (k: string) => isAdmin || mods.includes(k),
});

describe("productScopes", () => {
  it("admins get every scope incl. PERSONAL", () => {
    expect(productScopes(mk([], true), "OPERATE")).toEqual(["EGV", "XOONX", "PERSONAL"]);
  });
  it("purchasing gets EGV + XOONX (no PERSONAL)", () => {
    expect(productScopes(mk(["purchasing"]), "OPERATE")).toEqual(["EGV", "XOONX"]);
  });
  it("sales gets EGV only", () => {
    expect(productScopes(mk(["order_requests"]), "OPERATE")).toEqual(["EGV"]);
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
    expect(validateProduct({ name: "", scope: "EGV", type: "SUPPLEMENT" })).toHaveProperty("name");
    expect(validateProduct({ name: "X", scope: "BAD", type: "SUPPLEMENT" })).toHaveProperty("scope");
    expect(validateProduct({ name: "X", scope: "EGV", type: "BAD" })).toHaveProperty("type");
    expect(validateProduct({ name: "X", scope: "EGV", type: "SUPPLEMENT" })).toEqual({});
  });
});
