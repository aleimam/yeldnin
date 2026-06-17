// Pure item movement/state-engine logic. No DB/IO. Unit-tested.
import { ITEM_STATUS_ORDER, type ItemStatus } from "@/lib/workflow/workflow-logic";

/** Normal containers an item can sit in (exception pools use exceptionFlag). */
export const CONTAINER_TYPES = [
  "REQUEST",
  "PURCHASE",
  "PATCH",
  "TRANSFER",
  "TRIP",
  "HUB",
  "SHIPMENT",
  "ORDER",
] as const;
export type ContainerType = (typeof CONTAINER_TYPES)[number];

export const EXCEPTION_FLAGS = ["LOST", "DAMAGED", "ERRANT", "DELAYED"] as const;
export type ExceptionFlag = (typeof EXCEPTION_FLAGS)[number];
export function isExceptionFlag(v: unknown): v is ExceptionFlag {
  return typeof v === "string" && (EXCEPTION_FLAGS as readonly string[]).includes(v);
}

export function statusIndex(s: ItemStatus): number {
  return ITEM_STATUS_ORDER.indexOf(s);
}
/** The next canonical status, or null at the end of the line. */
export function nextStatus(s: ItemStatus): ItemStatus | null {
  const i = statusIndex(s);
  return i >= 0 && i < ITEM_STATUS_ORDER.length - 1 ? ITEM_STATUS_ORDER[i + 1] : null;
}
/** True if `to` is later in the lifecycle than `from`. */
export function isForward(from: ItemStatus, to: ItemStatus): boolean {
  return statusIndex(from) >= 0 && statusIndex(to) > statusIndex(from);
}

/**
 * Auto-advance off the timers: HUB --(transitAt)--> TRANSIT, then
 * TRANSIT --(globalShippingAt)--> GLOBAL_SHIPPING. Returns the due target or null.
 */
export interface TimedItem {
  status: string;
  transitAt?: Date | null;
  globalShippingAt?: Date | null;
}
export function dueAutoAdvance(item: TimedItem, now: Date): ItemStatus | null {
  if (item.status === "HUB" && item.transitAt && now.getTime() >= item.transitAt.getTime()) return "TRANSIT";
  if (item.status === "TRANSIT" && item.globalShippingAt && now.getTime() >= item.globalShippingAt.getTime())
    return "GLOBAL_SHIPPING";
  return null;
}

// Dashboard buckets for the Requests overview (item-level rollup).
export const ITEM_BUCKETS = ["requested", "onOrder", "inStock", "onWebsite", "problems"] as const;
export type ItemBucket = (typeof ITEM_BUCKETS)[number];

/** Which dashboard bucket an item falls in (exception flag wins → problems). */
export function itemBucket(status: string, exceptionFlag: string | null | undefined): ItemBucket {
  if (exceptionFlag) return "problems";
  switch (status) {
    case "REQUESTED":
      return "requested";
    case "ORDERED":
    case "SHIPPED":
    case "DELIVERED":
      return "onOrder";
    case "PHOTOS_SENT":
    case "WEBSITE":
      return "onWebsite";
    default: // HUB, TRANSIT, GLOBAL_SHIPPING, CUSTOMS, OUT_FOR_DELIVERY, OFFICE
      return "inStock";
  }
}

/** Pool an item currently sits in: its exception flag wins, else its container. */
export function poolKey(item: { exceptionFlag?: string | null; containerType?: string | null }): string {
  if (item.exceptionFlag) return `EXC:${item.exceptionFlag}`;
  return item.containerType ? `CON:${item.containerType}` : "NONE";
}
