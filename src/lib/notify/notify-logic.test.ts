import { describe, it, expect } from "vitest";
import {
  issueOpenedPayload,
  tripAwaitingApprovalPayload,
  itemsFlaggedPayload,
  isModuleOperator,
} from "./notify-logic";

describe("notify-logic payloads", () => {
  it("issue payload includes the UID and title, links to /issues", () => {
    const p = issueOpenedPayload({ uid: "ISS2606001", title: "Damaged box" });
    expect(p.body).toBe("ISS2606001 — Damaged box");
    expect(p.url).toBe("/issues");
    expect(p.tag).toBe("issue-ISS2606001");
  });

  it("issue payload tolerates a missing UID", () => {
    const p = issueOpenedPayload({ title: "No uid yet" });
    expect(p.body).toBe("No uid yet");
    expect(p.tag).toBe("issue");
  });

  it("trip-approval payload links to the trip and tags per trip", () => {
    const p = tripAwaitingApprovalPayload(42);
    expect(p.url).toBe("/trips/42");
    expect(p.tag).toBe("trip-approve-42");
    expect(p.body).toContain("#42");
  });

  it("flag payload pluralizes by count", () => {
    expect(itemsFlaggedPayload(1, "DELAYED").body).toBe("1 item flagged as DELAYED.");
    expect(itemsFlaggedPayload(3, "DAMAGED").body).toBe("3 items flagged as DAMAGED.");
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
