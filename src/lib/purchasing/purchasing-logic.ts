// Pure purchasing logic. No DB/IO. Unit-tested.
import { isScope } from "@/lib/products/products-logic";

// Destination of a purchase: a Hub abroad, or a Traveler's Trip.
export const PURCHASE_DEST_TYPES = ["HUB", "TRIP"] as const;
export type PurchaseDestType = (typeof PURCHASE_DEST_TYPES)[number];

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
