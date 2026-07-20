import { describe, it, expect } from "vitest";
import {
  isInquiryStatus,
  isUnitKind,
  shouldMarkAnswered,
  canReply,
  canClose,
  validateInquiryText,
  statusLabelKey,
  INQUIRY_MAX_BODY,
  canViewUnit,
  unitNeedsScope,
  type UnitViewAccess,
} from "./inquiry-logic";

// Build a mock access: `mods` maps module → granted level; admins bypass.
const acc = (mods: Record<string, "VIEW" | "OPERATE" | "MANAGE">, opts: { isAdmin?: boolean; hidesTripTraveler?: boolean } = {}): UnitViewAccess => {
  const RANK = { NONE: 0, VIEW: 1, OPERATE: 2, MANAGE: 3 } as const;
  const lvl = (k: string): keyof typeof RANK => mods[k] ?? "NONE";
  return {
    isAdmin: opts.isAdmin ?? false,
    hidesTripTraveler: opts.hidesTripTraveler ?? false,
    canModule: (k, min = "VIEW") => (opts.isAdmin ? true : RANK[lvl(k)] >= RANK[min]),
    can: (k, _cap) => (opts.isAdmin ? true : lvl(k) !== "NONE"),
  };
};

describe("inquiry-logic", () => {
  it("validates status + unit-kind enums", () => {
    expect(isInquiryStatus("ANSWERED")).toBe(true);
    expect(isInquiryStatus("nope")).toBe(false);
    expect(isUnitKind("ITEM")).toBe(true);
    expect(isUnitKind("PURCHASE")).toBe(true);
    expect(isUnitKind("WIDGET")).toBe(false);
  });

  it("shouldMarkAnswered only on a non-initiator reply to an OPEN inquiry", () => {
    expect(shouldMarkAnswered({ status: "OPEN", initiatorId: 1 }, 2)).toBe(true);
    expect(shouldMarkAnswered({ status: "OPEN", initiatorId: 1 }, 1)).toBe(false); // initiator follow-up
    expect(shouldMarkAnswered({ status: "ANSWERED", initiatorId: 1 }, 2)).toBe(false);
    expect(shouldMarkAnswered({ status: "CLOSED", initiatorId: 1 }, 2)).toBe(false);
  });

  it("canReply: any participant while not closed", () => {
    expect(canReply({ status: "OPEN", isParticipant: true })).toBe(true);
    expect(canReply({ status: "ANSWERED", isParticipant: true })).toBe(true);
    expect(canReply({ status: "CLOSED", isParticipant: true })).toBe(false);
    expect(canReply({ status: "OPEN", isParticipant: false })).toBe(false);
  });

  it("canClose: initiator side only, while not closed", () => {
    expect(canClose({ status: "ANSWERED", isInitiatorSide: true })).toBe(true);
    expect(canClose({ status: "OPEN", isInitiatorSide: true })).toBe(true);
    expect(canClose({ status: "CLOSED", isInitiatorSide: true })).toBe(false);
    expect(canClose({ status: "ANSWERED", isInitiatorSide: false })).toBe(false);
  });

  it("validateInquiryText requires body or attachment, caps length", () => {
    expect(validateInquiryText({ body: "  " })).toEqual({ ok: false, error: "inq.err.empty" });
    expect(validateInquiryText({ body: "", attachmentCount: 1 })).toEqual({ ok: true });
    expect(validateInquiryText({ body: "hi" })).toEqual({ ok: true });
    expect(validateInquiryText({ body: "x".repeat(INQUIRY_MAX_BODY + 1) })).toEqual({
      ok: false,
      error: "inq.err.tooLong",
    });
  });

  it("statusLabelKey maps to i18n keys, falling back to OPEN", () => {
    expect(statusLabelKey("CLOSED")).toBe("inq.status.CLOSED");
    expect(statusLabelKey("garbage")).toBe("inq.status.OPEN");
  });
});

describe("canViewUnit (inquiry unit authorization)", () => {
  it("REQUEST is scope-gated: Sales→VEEEY only, XOONX→XOONX only", () => {
    const sales = acc({ order_requests: "OPERATE" });
    const xoonx = acc({ xoonx: "OPERATE" });
    expect(canViewUnit(sales, "REQUEST", "VEEEY")).toBe(true);
    expect(canViewUnit(sales, "REQUEST", "XOONX")).toBe(false); // the leak this fix closes
    expect(canViewUnit(xoonx, "REQUEST", "XOONX")).toBe(true);
    expect(canViewUnit(xoonx, "REQUEST", "VEEEY")).toBe(false);
  });
  it("REQUEST with a missing record (null scope) is denied", () => {
    expect(canViewUnit(acc({ order_requests: "OPERATE" }), "REQUEST", null)).toBe(false);
  });
  it("Trip/Traveler need logistics/operations and are barred for a Sales-only member", () => {
    const salesOnly = acc({ order_requests: "OPERATE" }, { hidesTripTraveler: true });
    const logi = acc({ logistics: "VIEW" });
    const ops = acc({ operations: "VIEW" });
    expect(canViewUnit(salesOnly, "TRIP", null)).toBe(false);
    expect(canViewUnit(salesOnly, "TRAVELER", null)).toBe(false);
    expect(canViewUnit(logi, "TRIP", null)).toBe(true);
    expect(canViewUnit(ops, "TRIP", null)).toBe(true); // trip is logistics OR operations
    expect(canViewUnit(logi, "TRAVELER", null)).toBe(true);
    expect(canViewUnit(ops, "TRAVELER", null)).toBe(false); // traveler is logistics-only
  });
  it("container kinds map to their module", () => {
    expect(canViewUnit(acc({ logistics: "VIEW" }), "HUB", null)).toBe(true);
    expect(canViewUnit(acc({ logistics: "VIEW" }), "TRANSFER", null)).toBe(true);
    expect(canViewUnit(acc({ operations: "VIEW" }), "SHIPMENT", null)).toBe(true);
  });
  it("ITEM needs the item's own scope, not just the history module", () => {
    // Codex pass 2 (P0): this previously returned true on the MODULE alone, so a
    // Sales user could enumerate the people who handled a XOONX item and open a
    // persistent inquiry against it. ITEM is scope-bound like REQUEST/PURCHASE.
    const sales = acc({ history: "VIEW", order_requests: "MANAGE" }); // historyScopes → [VEEEY]
    expect(canViewUnit(sales, "ITEM", "VEEEY")).toBe(true);
    expect(canViewUnit(sales, "ITEM", "XOONX")).toBe(false);
    expect(canViewUnit(sales, "ITEM", null)).toBe(false); // missing record → denied
    const xoonx = acc({ history: "VIEW", xoonx: "MANAGE" }); // historyScopes → [XOONX]
    expect(canViewUnit(xoonx, "ITEM", "XOONX")).toBe(true);
    expect(canViewUnit(xoonx, "ITEM", "VEEEY")).toBe(false);
    // back office sees both lines
    expect(canViewUnit(acc({ history: "VIEW", logistics: "VIEW" }), "ITEM", "XOONX")).toBe(true);
  });
  it("PURCHASE needs purchasing VIEW + a matching product scope", () => {
    const purch = acc({ purchasing: "VIEW" });
    expect(canViewUnit(purch, "PURCHASE", "VEEEY")).toBe(true);
    expect(canViewUnit(purch, "PURCHASE", "XOONX")).toBe(true); // purchasing is cross-scope
    expect(canViewUnit(acc({ order_requests: "MANAGE" }), "PURCHASE", "VEEEY")).toBe(false);
  });
  it("unknown kinds are denied; admins pass everything", () => {
    expect(canViewUnit(acc({ logistics: "MANAGE" }), "WIDGET", null)).toBe(false);
    expect(canViewUnit(acc({}, { isAdmin: true }), "TRIP", null)).toBe(true);
    expect(canViewUnit(acc({}, { isAdmin: true }), "REQUEST", "XOONX")).toBe(true);
    expect(canViewUnit(acc({}, { isAdmin: true }), "WIDGET", null)).toBe(true);
  });
  it("unitNeedsScope flags only the scope-bound kinds", () => {
    expect(unitNeedsScope("REQUEST")).toBe(true);
    expect(unitNeedsScope("PURCHASE")).toBe(true);
    expect(unitNeedsScope("TRIP")).toBe(false);
    expect(unitNeedsScope("ITEM")).toBe(true); // Item carries a denormalized scope
  });
});
