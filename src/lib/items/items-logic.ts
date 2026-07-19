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

/**
 * Exception flags that PIN an item in place: it does NOT follow its container
 * when that container advances. All four flags pin — a flagged item (including
 * DELAYED) waits, frozen, until it is resolved/unflagged.
 */
export const HOLD_FLAGS: ExceptionFlag[] = ["LOST", "DAMAGED", "ERRANT", "DELAYED"];

/**
 * Prisma `where` fragment selecting items that should follow their container
 * when it advances: only un-flagged (NULL) items — any flag pins the item.
 * Carries a top-level `OR`, so don't merge it into a `where` that already uses
 * its own `OR`.
 */
export const MOVABLE_ITEMS_WHERE = {
  OR: [{ exceptionFlag: null }, { exceptionFlag: { notIn: HOLD_FLAGS } }],
};

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

/**
 * Sales-facing journey stages for the Product page's item statistics. A partition
 * (every item lands in exactly one): a flag wins → problems; otherwise by status.
 * "Purchased" folds Ordered/Shipped/Delivered (bought, en route to our hub);
 * Out-for-delivery sits under "In Egypt" (not Stock); Stock is the final three.
 */
export const PRODUCT_STAGES = ["requested", "purchased", "hubs", "globalShipping", "inEgypt", "stock", "problems"] as const;
export type ProductStage = (typeof PRODUCT_STAGES)[number];

export function itemStage(status: string, exceptionFlag?: string | null): ProductStage {
  if (exceptionFlag) return "problems";
  switch (status) {
    case "REQUESTED": return "requested";
    case "ORDERED":
    case "SHIPPED":
    case "DELIVERED": return "purchased";
    case "HUB": return "hubs";
    case "TRANSIT":
    case "GLOBAL_SHIPPING": return "globalShipping";
    case "CUSTOMS":
    case "OUT_FOR_DELIVERY": return "inEgypt";
    case "OFFICE":
    case "PHOTOS_SENT":
    case "WEBSITE": return "stock";
    default: return "stock";
  }
}

export interface ProductStageStats {
  requested: number;
  purchased: number;
  hubs: number;
  globalShipping: { transit: number; globalShipping: number; total: number };
  inEgypt: { customs: number; outForDelivery: number; total: number };
  stock: number;
  problems: number;
  total: number;
}

/** Full breakdown for the Product stats panel — top-level stages plus the two
 *  group sub-counts (Global Shipping → Transit/Global Shipping; In Egypt →
 *  Customs/Out-for-delivery). Sums to total. */
export function productStageStats(items: { status: string; exceptionFlag?: string | null }[]): ProductStageStats {
  const s: ProductStageStats = {
    requested: 0, purchased: 0, hubs: 0,
    globalShipping: { transit: 0, globalShipping: 0, total: 0 },
    inEgypt: { customs: 0, outForDelivery: 0, total: 0 },
    stock: 0, problems: 0, total: 0,
  };
  for (const it of items) {
    s.total++;
    if (it.exceptionFlag) { s.problems++; continue; }
    switch (it.status) {
      case "REQUESTED": s.requested++; break;
      case "ORDERED": case "SHIPPED": case "DELIVERED": s.purchased++; break;
      case "HUB": s.hubs++; break;
      case "TRANSIT": s.globalShipping.transit++; s.globalShipping.total++; break;
      case "GLOBAL_SHIPPING": s.globalShipping.globalShipping++; s.globalShipping.total++; break;
      case "CUSTOMS": s.inEgypt.customs++; s.inEgypt.total++; break;
      case "OUT_FOR_DELIVERY": s.inEgypt.outForDelivery++; s.inEgypt.total++; break;
      default: s.stock++; break; // OFFICE | PHOTOS_SENT | WEBSITE (+ any future tail)
    }
  }
  return s;
}

/** Top-level stage tally (no sub-counts) — for the per-request status summary. */
export function stageTally(items: { status: string; exceptionFlag?: string | null }[]): Record<ProductStage, number> {
  const out = Object.fromEntries(PRODUCT_STAGES.map((s) => [s, 0])) as Record<ProductStage, number>;
  for (const it of items) out[itemStage(it.status, it.exceptionFlag)]++;
  return out;
}

/** Pool an item currently sits in: its exception flag wins, else its container. */
export function poolKey(item: { exceptionFlag?: string | null; containerType?: string | null }): string {
  if (item.exceptionFlag) return `EXC:${item.exceptionFlag}`;
  return item.containerType ? `CON:${item.containerType}` : "NONE";
}

/** Item statuses before an item has been received at its destination (pre-HUB). */
export const PRE_RECEIPT_STATUSES: ItemStatus[] = ITEM_STATUS_ORDER.slice(0, ITEM_STATUS_ORDER.indexOf("HUB")) as ItemStatus[];

/**
 * Exclusive category buckets shown in container item-count summaries. An item
 * lands in exactly one, so the buckets sum to the total:
 *   PERSONAL scope → personal · XOONX scope → xoonx · else (VEEEY) by product
 *   type → injection / devices / items (supplements & everything else).
 */
export const CATEGORY_BUCKETS = ["items", "injection", "devices", "xoonx", "personal"] as const;
export type CategoryBucket = (typeof CATEGORY_BUCKETS)[number];

export function categoryBucket(scope: string, productType: string | null | undefined): CategoryBucket {
  if (scope === "PERSONAL") return "personal";
  if (scope === "XOONX") return "xoonx";
  if (productType === "INJECTION") return "injection";
  if (productType === "DEVICE") return "devices";
  return "items";
}

export type CategoryCounts = Record<CategoryBucket, number> & { total: number };
export function emptyCategoryCounts(): CategoryCounts {
  return { total: 0, items: 0, injection: 0, devices: 0, xoonx: 0, personal: 0 };
}

/** Tally a list of items into the exclusive category buckets (+ total). */
export function tallyCategories(rows: { scope: string; productType?: string | null }[]): CategoryCounts {
  const c = emptyCategoryCounts();
  for (const r of rows) {
    c[categoryBucket(r.scope, r.productType)]++;
    c.total++;
  }
  return c;
}

/** i18n key for each bucket's label — reuses the existing product-type / scope
 *  labels; only the generic "items" bucket needs its own key. */
const CATEGORY_LABEL_KEYS: Record<CategoryBucket, string> = {
  items: "itemcat.items",
  injection: "ptype.INJECTION",
  devices: "ptype.DEVICE",
  xoonx: "ptype.XOONX",
  personal: "scope.PERSONAL",
};

/** Build the {bucket → label} map from a translator. */
export function categoryLabels(t: (k: string) => string): Record<CategoryBucket, string> {
  return Object.fromEntries(CATEGORY_BUCKETS.map((b) => [b, t(CATEGORY_LABEL_KEYS[b])])) as Record<CategoryBucket, string>;
}
