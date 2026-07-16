import { describe, it, expect } from "vitest";
import { validateIssue, validateCompensation, isCompensationType, issueVisibility, issueVisible } from "./issues-logic";
import type { AccessLike } from "@/lib/products/products-logic";

const mk = (mods: Record<string, "VIEW" | "OPERATE" | "MANAGE">, isAdmin = false): AccessLike => {
  const RANK = { NONE: 0, VIEW: 1, OPERATE: 2, MANAGE: 3 } as const;
  const lvl = (k: string): keyof typeof RANK => mods[k] ?? "NONE";
  return {
    isAdmin,
    canModule: (k, min = "VIEW") => isAdmin || RANK[lvl(k)] >= RANK[min],
    can: (k) => isAdmin || lvl(k) !== "NONE",
  };
};

describe("validateIssue", () => {
  it("requires a title", () => {
    expect(validateIssue({ title: "" })).toHaveProperty("title");
    expect(validateIssue({ title: "Damaged bottle" })).toEqual({});
  });
});

describe("validateCompensation", () => {
  it("requires a valid type; money needs a positive amount", () => {
    expect(validateCompensation({ type: "NOPE" })).toHaveProperty("type");
    expect(validateCompensation({ type: "MONEY", amountEgp: 0 })).toHaveProperty("amount");
    expect(validateCompensation({ type: "MONEY", amountEgp: 500 })).toEqual({});
    expect(validateCompensation({ type: "PRODUCT" })).toEqual({});
  });
  it("guards the type enum", () => {
    expect(isCompensationType("PRODUCT")).toBe(true);
    expect(isCompensationType("CASH")).toBe(false);
  });
});

describe("issueVisibility (blueprint: domain-scoped, Sales barred)", () => {
  it("admin and the cross-scope back office see every issue", () => {
    expect(issueVisibility(mk({}, true))).toBe("all");
    expect(issueVisibility(mk({ logistics: "VIEW" }))).toBe("all");
    expect(issueVisibility(mk({ operations: "VIEW" }))).toBe("all");
    expect(issueVisibility(mk({ purchasing: "VIEW" }))).toBe("all");
  });
  it("a dedicated issue handler (issues OPERATE, no line) is cross-scope", () => {
    expect(issueVisibility(mk({ issues: "OPERATE" }))).toBe("all");
    expect(issueVisibility(mk({ issues: "MANAGE" }))).toBe("all");
  });
  it("XOONX is scoped to its own line — even with issues OPERATE", () => {
    expect(issueVisibility(mk({ xoonx: "VIEW" }))).toEqual(["XOONX"]);
    expect(issueVisibility(mk({ xoonx: "OPERATE", issues: "OPERATE" }))).toEqual(["XOONX"]);
  });
  it("Sales is barred — even mis-granted the issues module", () => {
    expect(issueVisibility(mk({ order_requests: "MANAGE" }))).toBeNull();
    expect(issueVisibility(mk({ order_requests: "OPERATE", issues: "VIEW" }))).toBeNull();
    expect(issueVisibility(mk({}))).toBeNull();
  });
  it("a dual Sales+logistics role still sees issues (via logistics)", () => {
    expect(issueVisibility(mk({ order_requests: "OPERATE", logistics: "VIEW" }))).toBe("all");
  });
});

describe("issueVisible (one issue under a visibility)", () => {
  it("null visibility sees nothing", () => {
    expect(issueVisible(null, "XOONX")).toBe(false);
    expect(issueVisible(null, null)).toBe(false);
  });
  it("'all' sees every issue including unscoped ones", () => {
    expect(issueVisible("all", "EGV")).toBe(true);
    expect(issueVisible("all", "XOONX")).toBe(true);
    expect(issueVisible("all", null)).toBe(true);
  });
  it("a scoped viewer sees only its scope, never unscoped back-office issues", () => {
    expect(issueVisible(["XOONX"], "XOONX")).toBe(true);
    expect(issueVisible(["XOONX"], "EGV")).toBe(false);
    expect(issueVisible(["XOONX"], null)).toBe(false);
  });
});
