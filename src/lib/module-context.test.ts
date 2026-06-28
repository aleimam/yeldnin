import { describe, it, expect } from "vitest";
import { moduleContextScopes } from "./module-context";

describe("moduleContextScopes", () => {
  it("scopes Sales → EGV and XOONX → XOONX", () => {
    expect(moduleContextScopes("order_requests")).toEqual(["EGV"]);
    expect(moduleContextScopes("xoonx")).toEqual(["XOONX"]);
  });
  it("scopes Logistics → both operational scopes (it fulfils requests)", () => {
    expect(moduleContextScopes("logistics")).toEqual(["EGV", "XOONX"]);
  });
  it("does not restrict other modules", () => {
    expect(moduleContextScopes("purchasing")).toBeNull();
    expect(moduleContextScopes("anything")).toBeNull();
  });
});
