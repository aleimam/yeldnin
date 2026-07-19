import { describe, it, expect } from "vitest";
import { moduleContextScopes } from "./module-context";

describe("moduleContextScopes", () => {
  it("scopes Sales → VEEEY and XOONX → XOONX", () => {
    expect(moduleContextScopes("order_requests")).toEqual(["VEEEY"]);
    expect(moduleContextScopes("xoonx")).toEqual(["XOONX"]);
  });
  it("scopes Logistics → both operational scopes (it fulfils requests)", () => {
    expect(moduleContextScopes("logistics")).toEqual(["VEEEY", "XOONX"]);
  });
  it("does not restrict other modules", () => {
    expect(moduleContextScopes("purchasing")).toBeNull();
    expect(moduleContextScopes("anything")).toBeNull();
  });
});
