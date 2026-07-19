import { describe, it, expect } from "vitest";
import { historyScopes } from "./history-logic";
import type { AccessLike } from "@/lib/products/products-logic";

const mk = (mods: string[], isAdmin = false): AccessLike => ({
  isAdmin,
  canModule: (k: string) => isAdmin || mods.includes(k),
  can: (k: string) => isAdmin || mods.includes(k),
});

describe("historyScopes (golden-rule history partition)", () => {
  it("admins see every scope, including PERSONAL", () => {
    expect(historyScopes(mk([], true))).toEqual(["VEEEY", "XOONX", "PERSONAL"]);
  });
  it("the physical-handling back office is cross-scope over VEEEY + XOONX", () => {
    expect(historyScopes(mk(["logistics"]))).toEqual(["VEEEY", "XOONX"]);
    expect(historyScopes(mk(["operations"]))).toEqual(["VEEEY", "XOONX"]);
    expect(historyScopes(mk(["purchasing"]))).toEqual(["VEEEY", "XOONX"]);
  });
  it("Sales sees only VEEEY, XOONX only XOONX", () => {
    expect(historyScopes(mk(["order_requests"]))).toEqual(["VEEEY"]);
    expect(historyScopes(mk(["xoonx"]))).toEqual(["XOONX"]);
  });
  it("never surfaces PERSONAL to a non-admin, even cross-scope roles", () => {
    expect(historyScopes(mk(["logistics", "order_requests", "xoonx"]))).toEqual(["VEEEY", "XOONX"]);
  });
  it("a history-only user with no scope-granting module sees nothing", () => {
    expect(historyScopes(mk(["history"]))).toEqual([]);
    expect(historyScopes(mk([]))).toEqual([]);
  });
});
