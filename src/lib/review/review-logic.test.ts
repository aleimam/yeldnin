import { describe, it, expect } from "vitest";
import { teamsUserCanMark, validateMark, TEAM_MODULE, type AccessLike } from "./review-logic";

const mk = (mods: string[], isAdmin = false): AccessLike => ({
  isAdmin,
  canModule: (k: string) => isAdmin || mods.includes(k),
});

describe("teamsUserCanMark", () => {
  it("maps operable modules to their review teams", () => {
    expect(teamsUserCanMark(mk(["purchasing"]))).toEqual(["PURCHASING"]);
    expect(teamsUserCanMark(mk(["logistics", "operations"]))).toEqual(["LOGISTICS", "OPERATIONS"]);
    expect(teamsUserCanMark(mk([]))).toEqual([]);
  });
  it("admins can mark all three", () => {
    expect(teamsUserCanMark(mk([], true))).toEqual(["PURCHASING", "LOGISTICS", "OPERATIONS"]);
  });
  it("team→module map is correct", () => {
    expect(TEAM_MODULE.PURCHASING).toBe("purchasing");
    expect(TEAM_MODULE.LOGISTICS).toBe("logistics");
    expect(TEAM_MODULE.OPERATIONS).toBe("operations");
  });
});

describe("validateMark", () => {
  it("requires a valid status; ISSUE needs a note", () => {
    expect(validateMark({ status: "MAYBE" })).toHaveProperty("status");
    expect(validateMark({ status: "ISSUE", note: "" })).toHaveProperty("note");
    expect(validateMark({ status: "ISSUE", note: "broken seal" })).toEqual({});
    expect(validateMark({ status: "OK" })).toEqual({});
  });
});
