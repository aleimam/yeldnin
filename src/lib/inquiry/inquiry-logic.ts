// Pure inquiry logic. No DB/IO. Unit-tested. See CHAT.md.
// An inquiry is a question about a unit, routed to a user who acted on it. The
// first reply from the recipient side flips OPEN → ANSWERED; anyone on the
// initiator's team CLOSES it with a disposition.
import { requestScopes } from "@/lib/requests/request-logic";
import { productScopes, type AccessLike, type Scope } from "@/lib/products/products-logic";

export const INQUIRY_STATUSES = ["OPEN", "ANSWERED", "CLOSED"] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];
export function isInquiryStatus(v: unknown): v is InquiryStatus {
  return typeof v === "string" && (INQUIRY_STATUSES as readonly string[]).includes(v);
}

// Units an inquiry can target: an Item, or a "container" that holds items.
export const UNIT_KINDS = [
  "ITEM",
  "REQUEST",
  "PURCHASE",
  "PATCH",
  "TRANSFER",
  "TRIP",
  "HUB",
  "TRAVELER",
  "SHIPMENT",
  "ORDER",
] as const;
export type UnitKind = (typeof UNIT_KINDS)[number];
export function isUnitKind(v: unknown): v is UnitKind {
  return typeof v === "string" && (UNIT_KINDS as readonly string[]).includes(v);
}

export const INQUIRY_MAX_BODY = 4000;

/** A reply from anyone other than the initiator moves OPEN → ANSWERED (the
 *  recipient side has responded). Initiator follow-ups don't change the status. */
export function shouldMarkAnswered(
  inq: { status: string; initiatorId: number },
  replierId: number,
): boolean {
  return inq.status === "OPEN" && replierId !== inq.initiatorId;
}

/** Anyone who can see the inquiry may reply — unless it's closed. */
export function canReply(p: { status: string; isParticipant: boolean }): boolean {
  return p.isParticipant && p.status !== "CLOSED";
}

/** Only the initiator side (their team) closes, and only while not already closed. */
export function canClose(p: { status: string; isInitiatorSide: boolean }): boolean {
  return p.isInitiatorSide && p.status !== "CLOSED";
}

/** Validate an inquiry message (first message or reply). Returns an i18n key. */
export function validateInquiryText(input: { body?: string; attachmentCount?: number }):
  | { ok: true }
  | { ok: false; error: string } {
  const body = (input.body ?? "").trim();
  const n = input.attachmentCount ?? 0;
  if (!body && n === 0) return { ok: false, error: "inq.err.empty" };
  if (body.length > INQUIRY_MAX_BODY) return { ok: false, error: "inq.err.tooLong" };
  return { ok: true };
}

/** i18n key for a status badge. */
export function statusLabelKey(status: string): string {
  return `inq.status.${isInquiryStatus(status) ? status : "OPEN"}`;
}

// ─── unit visibility (server-action authorization) ────────────────────────────

/** Minimal access shape needed to authorize which units a user may reach. */
export type UnitViewAccess = AccessLike & { hidesTripTraveler: boolean };

/** Whether a unit kind's visibility depends on the record's own VEEEY/XOONX scope
 *  (so the caller must load that scope before deciding). */
export function unitNeedsScope(unitKind: string): boolean {
  return unitKind === "REQUEST" || unitKind === "PURCHASE";
}

/**
 * May this user VIEW a unit of the given kind? Mirrors the access gate on each
 * unit's detail page, so the inquiry server actions (directly POST-able) can't
 * be used to reach a unit the caller could never open — e.g. a Sales user
 * enumerating actors on a XOONX request, a Trip, or a Traveler. For scope-bound
 * kinds (REQUEST/PURCHASE) pass the record's scope (null = record missing →
 * denied). Unknown kinds are denied; admins pass everything.
 */
export function canViewUnit(access: UnitViewAccess, unitKind: string, recordScope?: string | null): boolean {
  if (access.isAdmin) return true;
  const logistics = access.canModule("logistics", "VIEW");
  const operations = access.canModule("operations", "VIEW");
  switch (unitKind) {
    case "REQUEST":
      return recordScope != null && requestScopes(access, "VIEW").includes(recordScope as Scope);
    case "PURCHASE":
      return recordScope != null && access.canModule("purchasing", "VIEW") && productScopes(access, "VIEW").includes(recordScope as Scope);
    case "ITEM":
      return access.canModule("history", "VIEW");
    case "HUB":
    case "PATCH":
    case "TRANSFER":
      return logistics;
    case "SHIPMENT":
      return operations;
    case "ORDER": // back-office supplier order — never a Sales/XOONX unit
      return logistics || access.canModule("purchasing", "VIEW");
    case "TRAVELER":
      return logistics && !access.hidesTripTraveler;
    case "TRIP":
      return (logistics || operations) && !access.hidesTripTraveler;
    default:
      return false;
  }
}
