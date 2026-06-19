import { describe, it, expect } from "vitest";
import {
  EXCEPTION_POOLS,
  isExceptionPool,
  poolOpensIssue,
  resolutionActions,
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
    expect(resolutionActions("LOST")).toEqual(["recover", "rebuy", "compensate", "close"]);
    expect(resolutionActions("DAMAGED")).toEqual(["recover", "rebuy", "compensate", "close"]);
    // Errant is never final — only recover or convert to a loss
    expect(resolutionActions("ERRANT")).toEqual(["recover", "convertLost", "convertDamaged"]);
    expect(resolutionActions("DELAYED")).toEqual(["assignTrip", "recover"]);
    // every pool can always be recovered back to a normal status
    for (const p of EXCEPTION_POOLS) expect(resolutionActions(p)).toContain("recover");
    // a loss can be settled (closed); Errant cannot be closed directly
    expect(resolutionActions("LOST")).toContain("close");
    expect(resolutionActions("ERRANT")).not.toContain("close");
  });
});
