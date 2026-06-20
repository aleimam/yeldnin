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
} from "./inquiry-logic";

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
