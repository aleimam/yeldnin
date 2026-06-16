// Pure patch logic. No DB/IO. Unit-tested.

export const PATCH_STATUSES = ["DISPATCHED", "DELIVERED", "RECEIVED"] as const;
export type PatchStatus = (typeof PATCH_STATUSES)[number];

/** The item status that each patch status drives (from Status.xlsx). */
export const PATCH_TO_ITEM_STATUS: Record<PatchStatus, string> = {
  DISPATCHED: "SHIPPED",
  DELIVERED: "DELIVERED",
  RECEIVED: "HUB",
};

/** The next patch status, or null at the end. */
export function nextPatchStatus(s: PatchStatus): PatchStatus | null {
  const i = PATCH_STATUSES.indexOf(s);
  return i >= 0 && i < PATCH_STATUSES.length - 1 ? PATCH_STATUSES[i + 1] : null;
}

export function validatePatch(input: { purchaseId?: number | null; itemIds?: number[] }): Record<string, string> {
  const e: Record<string, string> = {};
  if (!input.purchaseId) e.purchase = "Choose the purchase to dispatch from.";
  if (!input.itemIds?.length) e.items = "Select at least one item to dispatch.";
  return e;
}
