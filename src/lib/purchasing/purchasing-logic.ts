// Pure purchasing logic. No DB/IO. Unit-tested.
import { isScope } from "@/lib/products/products-logic";
import type { ItemStatus } from "@/lib/workflow/workflow-logic";
import { HOLD_FLAGS } from "@/lib/items/items-logic";

// Destination of a purchase: a Hub abroad, or a Traveler's Trip.
export const PURCHASE_DEST_TYPES = ["HUB", "TRIP"] as const;
export type PurchaseDestType = (typeof PURCHASE_DEST_TYPES)[number];

export const PURCHASE_STATUSES = ["NEW", "DISPATCHED", "DELIVERED", "RECEIVED"] as const;
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];
export function nextPurchaseStatus(s: string): PurchaseStatus | null {
  const i = (PURCHASE_STATUSES as readonly string[]).indexOf(s);
  return i >= 0 && i < PURCHASE_STATUSES.length - 1 ? PURCHASE_STATUSES[i + 1] : null;
}
export function prevPurchaseStatus(s: string): PurchaseStatus | null {
  const i = (PURCHASE_STATUSES as readonly string[]).indexOf(s);
  return i > 0 ? PURCHASE_STATUSES[i - 1] : null;
}

/**
 * The item status that mirrors each purchase status — the boundary a status step
 * cascades across. A purchase's units sit at this status while the purchase rests
 * at the matching level; advancing/reverting the purchase moves them to the next
 * level's status.
 */
export const PURCHASE_ITEM_STATUS: Record<PurchaseStatus, ItemStatus> = {
  NEW: "ORDERED",
  DISPATCHED: "SHIPPED",
  DELIVERED: "DELIVERED",
  RECEIVED: "HUB",
};

/** An item follows its container only when un-flagged — any hold flag pins it. */
export function isMovableFlag(flag: string | null | undefined): boolean {
  return flag == null || !(HOLD_FLAGS as string[]).includes(flag);
}

/**
 * How many of a purchase's items a single status step would move: the un-pinned
 * units sitting at the item-status that mirrors the purchase's *current* status
 * (the set is the same whether stepping forward or back). For RECEIVED (item
 * status HUB) this naturally excludes units that have already left the hub — a
 * backward step leaves those in the operations pipeline untouched.
 */
export function purchaseCascadeCount(
  items: { status: string; exceptionFlag?: string | null }[],
  current: string,
): number {
  const fromItem = PURCHASE_ITEM_STATUS[current as PurchaseStatus];
  if (!fromItem) return 0;
  return items.filter((it) => it.status === fromItem && isMovableFlag(it.exceptionFlag)).length;
}

export interface PurchaseLineInput {
  productId: number;
  count: number;
}
export function validatePurchase(input: {
  scope?: string;
  destinationType?: string;
  destinationId?: number | null;
  lines?: PurchaseLineInput[];
}): Record<string, string> {
  const e: Record<string, string> = {};
  if (!isScope(input.scope ?? "")) e.scope = "A valid scope is required.";
  if (!(PURCHASE_DEST_TYPES as readonly string[]).includes(input.destinationType ?? "")) {
    e.destinationType = "Choose a destination type.";
  } else if (!input.destinationId) {
    e.destination = "Choose a destination.";
  }
  const lines = (input.lines ?? []).filter((l) => l.productId && l.count >= 1);
  if (!lines.length) e.lines = "Choose at least one product to purchase.";
  return e;
}

/** Clamp each requested line to what the pool actually has available. */
export function clampLinesToPool(
  lines: PurchaseLineInput[],
  available: Map<number, number>,
): PurchaseLineInput[] {
  return lines
    .map((l) => ({ productId: l.productId, count: Math.min(Math.floor(l.count), available.get(l.productId) ?? 0) }))
    .filter((l) => l.count >= 1);
}
