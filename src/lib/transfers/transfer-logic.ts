// Pure transfer logic. No DB/IO. Unit-tested.
//
// A Transfer moves received stock between two destinations (Hub / Trip /
// Traveler-holding) within the same country. It advances NEW → LEFT_ORIGIN →
// DELIVERED → RECEIVED, like a Patch; at RECEIVED its items re-receive at the
// destination (status HUB + timers reset — handled in the service).

export const TRANSFER_STATUSES = ["NEW", "LEFT_ORIGIN", "DELIVERED", "RECEIVED"] as const;
export type TransferStatus = (typeof TRANSFER_STATUSES)[number];

/** The next status, or null once RECEIVED (terminal). */
export function nextTransferStatus(s: string): TransferStatus | null {
  const i = (TRANSFER_STATUSES as readonly string[]).indexOf(s);
  return i >= 0 && i < TRANSFER_STATUSES.length - 1 ? TRANSFER_STATUSES[i + 1] : null;
}

/** The step at which items re-receive at the destination. */
export const TRANSFER_RECEIVE_STATUS: TransferStatus = "RECEIVED";

/** Can this transfer still advance (not yet received)? */
export function canAdvanceTransfer(status: string): boolean {
  return nextTransferStatus(status) !== null;
}

export const TRANSFER_ENDPOINTS = ["HUB", "TRIP", "TRAVELER"] as const;
export type TransferEndpoint = (typeof TRANSFER_ENDPOINTS)[number];
export function isTransferEndpoint(v: unknown): v is TransferEndpoint {
  return typeof v === "string" && (TRANSFER_ENDPOINTS as readonly string[]).includes(v);
}

export interface TransferDraft {
  fromType?: string | null;
  fromId?: number | null;
  toType?: string | null;
  toId?: number | null;
  fromCountry?: string | null;
  toCountry?: string | null;
  itemCount?: number;
}

/** Validate a transfer draft: endpoints chosen + distinct, same country, ≥1 item. */
export function validateTransfer(d: TransferDraft): Record<string, string> {
  const e: Record<string, string> = {};
  if (!isTransferEndpoint(d.fromType) || !d.fromId) e.from = "Choose a source.";
  if (!isTransferEndpoint(d.toType) || !d.toId) e.to = "Choose a destination.";
  if (d.fromType && d.toType && d.fromType === d.toType && d.fromId === d.toId) e.to = "Source and destination must differ.";
  if (d.fromCountry && d.toCountry && d.fromCountry !== d.toCountry) e.country = "Transfers must stay within the same country.";
  if (!d.itemCount) e.items = "Select at least one item to transfer.";
  return e;
}
