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
