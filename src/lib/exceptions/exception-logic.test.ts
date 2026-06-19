import { describe, it, expect } from "vitest";
import {
  EXCEPTION_POOLS,
  isExceptionPool,
  poolOpensIssue,
  resolutionActions,
  actionNeedsTarget,
  clearLabelKey,
} from "./exception-logic";

describe("exception-logic", () => {
  it("recognizes the four pools and rejects junk", () => {
    expect(EXCEPTION_POOLS).toEqual(["LOST", "DAMAGED", "ERRANT", "DELAYED"]);
    for (const p of EXCEPTION_POOLS) expect(isExceptionPool(p)).toBe(true);
    expect(isExceptionPool("WEBSITE")).toBe(false);
    expect(isExceptionPool(null)).toBe(false);
    expect(isExceptionPool(123)).toBe(false);
  });

  it("opens an Issue for loss pools but not for Delayed", () => {
    expect(poolOpensIssue("LOST")).toBe(true);
    expect(poolOpensIssue("DAMAGED")).toBe(true);
    expect(poolOpensIssue("ERRANT")).toBe(true);
    expect(poolOpensIssue("DELAYED")).toBe(false);
  });

  it("offers the right resolution actions per pool", () => {
    expect(resolutionActions("LOST")).toEqual(["rebuy", "compensate", "clear"]);
    expect(resolutionActions("DAMAGED")).toEqual(["rebuy", "compensate", "clear"]);
    expect(resolutionActions("ERRANT")).toEqual(["move", "rebuy", "clear"]);
    expect(resolutionActions("DELAYED")).toEqual(["assignTrip", "clear"]);
    // every pool can always at least be cleared
    for (const p of EXCEPTION_POOLS) expect(resolutionActions(p)).toContain("clear");
  });

  it("knows which actions need a target container", () => {
    expect(actionNeedsTarget("move")).toBe(true);
    expect(actionNeedsTarget("assignTrip")).toBe(true);
    expect(actionNeedsTarget("clear")).toBe(false);
    expect(actionNeedsTarget("rebuy")).toBe(false);
    expect(actionNeedsTarget("compensate")).toBe(false);
  });

  it("labels the clear action Found for loss pools, Clear for Delayed", () => {
    expect(clearLabelKey("LOST")).toBe("exceptions.action.found");
    expect(clearLabelKey("ERRANT")).toBe("exceptions.action.found");
    expect(clearLabelKey("DELAYED")).toBe("exceptions.action.clear");
  });
});
