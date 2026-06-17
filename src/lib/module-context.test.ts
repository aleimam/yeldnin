import { describe, it, expect } from "vitest";
import { moduleContextScopes } from "./module-context";

describe("moduleContextScopes", () => {
  it("scopes Sales → EGV and XOONX → XOONX", () => {
    expect(moduleContextScopes("order_requests")).toEqual(["EGV"]);
    expect(moduleContextScopes("xoonx")).toEqual(["XOONX"]);
  });
  it("does not restrict cross-scope modules", () => {
    expect(moduleContextScopes("logistics")).toBeNull();
    expect(moduleContextScopes("purchasing")).toBeNull();
    expect(moduleContextScopes("anything")).toBeNull();
  });
});
