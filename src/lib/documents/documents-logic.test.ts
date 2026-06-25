import { describe, it, expect } from "vitest";
import {
  isDocKind,
  isDocStatus,
  isGrantLevel,
  levelMeets,
  documentAccessLevel,
  canViewDocument,
  canEditContent,
  canManageDocument,
  isReviewDue,
  nextVersionNo,
} from "./documents-logic";

describe("type guards", () => {
  it("kinds / statuses / grant levels", () => {
    expect(isDocKind("PDF")).toBe(true);
    expect(isDocKind("DOC")).toBe(true);
    expect(isDocKind("X")).toBe(false);
    expect(isDocStatus("DRAFT")).toBe(true);
    expect(isDocStatus("PUBLISHED")).toBe(true);
    expect(isDocStatus("ARCHIVED")).toBe(false);
    expect(isGrantLevel("VIEW")).toBe(true);
    expect(isGrantLevel("MANAGE")).toBe(true);
    expect(isGrantLevel("NONE")).toBe(false);
  });
});

describe("documentAccessLevel", () => {
  const perms = [
    { teamKey: "sales", level: "VIEW" },
    { teamKey: "logistics", level: "OPERATE" },
    { teamKey: "development", level: "MANAGE" },
  ];
  it("admin and owner always MANAGE", () => {
    expect(documentAccessLevel({ isAdmin: true, isOwner: false, userTeamKeys: [], perms })).toBe("MANAGE");
    expect(documentAccessLevel({ isAdmin: false, isOwner: true, userTeamKeys: [], perms })).toBe("MANAGE");
  });
  it("takes the highest grant across the user's teams", () => {
    expect(documentAccessLevel({ isAdmin: false, isOwner: false, userTeamKeys: ["sales"], perms })).toBe("VIEW");
    expect(documentAccessLevel({ isAdmin: false, isOwner: false, userTeamKeys: ["sales", "logistics"], perms })).toBe("OPERATE");
    expect(documentAccessLevel({ isAdmin: false, isOwner: false, userTeamKeys: ["sales", "development"], perms })).toBe("MANAGE");
  });
  it("no matching team → NONE", () => {
    expect(documentAccessLevel({ isAdmin: false, isOwner: false, userTeamKeys: ["couriers"], perms })).toBe("NONE");
    expect(documentAccessLevel({ isAdmin: false, isOwner: false, userTeamKeys: [], perms: [] })).toBe("NONE");
  });
});

describe("visibility & capabilities", () => {
  it("NONE never sees a document", () => {
    expect(canViewDocument("PUBLISHED", "NONE")).toBe(false);
    expect(canViewDocument("DRAFT", "NONE")).toBe(false);
  });
  it("VIEW sees published but not drafts", () => {
    expect(canViewDocument("PUBLISHED", "VIEW")).toBe(true);
    expect(canViewDocument("DRAFT", "VIEW")).toBe(false);
  });
  it("OPERATE+ sees drafts", () => {
    expect(canViewDocument("DRAFT", "OPERATE")).toBe(true);
    expect(canViewDocument("DRAFT", "MANAGE")).toBe(true);
  });
  it("edit/manage gates", () => {
    expect(canEditContent("VIEW")).toBe(false);
    expect(canEditContent("OPERATE")).toBe(true);
    expect(canManageDocument("OPERATE")).toBe(false);
    expect(canManageDocument("MANAGE")).toBe(true);
    expect(levelMeets("MANAGE", "OPERATE")).toBe(true);
    expect(levelMeets("VIEW", "OPERATE")).toBe(false);
  });
});

describe("review-due & versions", () => {
  const now = new Date("2026-06-25T00:00:00Z");
  it("isReviewDue: only when a past date is set", () => {
    expect(isReviewDue(null, now)).toBe(false);
    expect(isReviewDue(undefined, now)).toBe(false);
    expect(isReviewDue(new Date("2026-06-24T00:00:00Z"), now)).toBe(true);
    expect(isReviewDue(new Date("2026-06-25T00:00:00Z"), now)).toBe(true);
    expect(isReviewDue(new Date("2026-06-26T00:00:00Z"), now)).toBe(false);
  });
  it("nextVersionNo increments from the current max", () => {
    expect(nextVersionNo(0)).toBe(1);
    expect(nextVersionNo(5)).toBe(6);
    expect(nextVersionNo(-3)).toBe(1);
  });
});
