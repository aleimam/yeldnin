import { describe, it, expect } from "vitest";
import { makeT } from "@/i18n";
import {
  issueOpenedPayload,
  tripAwaitingApprovalPayload,
  itemsFlaggedPayload,
  unitUpdatePayload,
  isModuleOperator,
  modulesForScope,
} from "./notify-logic";

const t = makeT("en");

describe("notify-logic payloads", () => {
  it("issue payload includes the UID and title, links to /issues", () => {
    const p = issueOpenedPayload(t, { uid: "ISS2606001", title: "Damaged box" });
    expect(p.body).toBe("ISS2606001 — Damaged box");
    expect(p.url).toBe("/issues");
    expect(p.tag).toBe("issue-ISS2606001");
  });

  it("issue payload tolerates a missing UID", () => {
    const p = issueOpenedPayload(t, { title: "No uid yet" });
    expect(p.body).toBe("No uid yet");
    expect(p.tag).toBe("issue");
  });

  it("trip-approval payload links to the trip and tags per trip", () => {
    const p = tripAwaitingApprovalPayload(t, 42);
    expect(p.url).toBe("/trips/42");
    expect(p.tag).toBe("trip-approve-42");
    expect(p.body).toContain("#42");
  });

  it("flag payload includes the count and flag", () => {
    expect(itemsFlaggedPayload(t, 1, "DELAYED").body).toBe("1 flagged as DELAYED.");
    expect(itemsFlaggedPayload(t, 3, "DAMAGED").body).toBe("3 flagged as DAMAGED.");
  });

  it("unit-update payload links to the order and tags per (order, status)", () => {
    const p = unitUpdatePayload(t, { uid: "REQ2606007", statusLabel: "Shipped", requestId: 7 });
    expect(p.body).toBe("REQ2606007 — now Shipped.");
    expect(p.url).toBe("/requests/7");
    expect(p.tag).toBe("unit-7-Shipped");
  });

  it("unit-update payload tolerates a missing UID", () => {
    expect(unitUpdatePayload(t, { statusLabel: "Listed on website", requestId: 9 }).body).toBe("now Listed on website.");
  });
});

describe("isModuleOperator (notification audience)", () => {
  const perms = (m: string, l: "VIEW" | "OPERATE" | "MANAGE") => [{ moduleKey: m, level: l }];

  it("admins always receive, regardless of module perms", () => {
    expect(isModuleOperator("ADMIN", [], ["issues"])).toBe(true);
    expect(isModuleOperator("SUPER_ADMIN", [], ["purchasing"])).toBe(true);
  });

  it("non-admin with OPERATE+ on a listed module receives", () => {
    expect(isModuleOperator("MEMBER", perms("issues", "OPERATE"), ["issues"])).toBe(true);
    expect(isModuleOperator("MEMBER", perms("logistics", "MANAGE"), ["purchasing", "logistics"])).toBe(true);
  });

  it("VIEW-only is excluded (default threshold is OPERATE)", () => {
    expect(isModuleOperator("MEMBER", perms("issues", "VIEW"), ["issues"])).toBe(false);
  });

  it("access to a different module doesn't qualify", () => {
    expect(isModuleOperator("MEMBER", perms("pricing", "MANAGE"), ["issues"])).toBe(false);
  });

  it("no relevant perms → excluded", () => {
    expect(isModuleOperator("MEMBER", [], ["issues"])).toBe(false);
  });
});

describe("modulesForScope (golden-rule notification filter)", () => {
  it("drops the other line's scope-bound module for a scoped record", () => {
    // An VEEEY record must not reach XOONX operators, and vice-versa.
    expect(modulesForScope(["order_requests", "xoonx"], "VEEEY")).toEqual(["order_requests"]);
    expect(modulesForScope(["order_requests", "xoonx"], "XOONX")).toEqual(["xoonx"]);
  });
  it("keeps cross-scope modules for either scope", () => {
    expect(modulesForScope(["purchasing", "logistics", "operations"], "VEEEY")).toEqual(["purchasing", "logistics", "operations"]);
    expect(modulesForScope(["xoonx", "purchasing"], "XOONX")).toEqual(["xoonx", "purchasing"]);
  });
  it("PERSONAL scope drops both business-line modules (admin-only records)", () => {
    expect(modulesForScope(["order_requests", "xoonx", "logistics"], "PERSONAL")).toEqual(["logistics"]);
  });
  it("no scope → list unchanged (non-scoped event)", () => {
    expect(modulesForScope(["order_requests", "xoonx"], null)).toEqual(["order_requests", "xoonx"]);
    expect(modulesForScope(["issues"], undefined)).toEqual(["issues"]);
  });
});
