// Pure supply-chain workflow core. No DB / no I/O. Unit-tested.
//
// DECISION "A": the lifecycle stages, transitions and system behaviours are
// FIXED here (anchored to the stable status KEYS the business logic depends on).
// Admins may only override the *presentation* layer — labels, which steps a
// Sales view carries forward (hides), and the auto-advance timer ranges — via
// WorkflowOverrides (stored in the WorkflowConfig singleton, merged at read).
//
// Defaults below are transcribed from Status.xlsx.

export type Locale = "en" | "ar";

// ── Canonical item status (the single source of truth) ───────────────────────
export type ItemStatus =
  | "REQUESTED"
  | "ORDERED"
  | "SHIPPED"
  | "DELIVERED"
  | "HUB"
  | "TRANSIT"
  | "GLOBAL_SHIPPING"
  | "CUSTOMS"
  | "OUT_FOR_DELIVERY"
  | "OFFICE"
  | "PHOTOS_SENT"
  | "WEBSITE";

/** Canonical order of the item lifecycle (index = progression). */
export const ITEM_STATUS_ORDER: ItemStatus[] = [
  "REQUESTED",
  "ORDERED",
  "SHIPPED",
  "DELIVERED",
  "HUB",
  "TRANSIT",
  "GLOBAL_SHIPPING",
  "CUSTOMS",
  "OUT_FOR_DELIVERY",
  "OFFICE",
  "PHOTOS_SENT",
  "WEBSITE",
];

interface Labels {
  en: string;
  ar: string;
}
/** Default EN/AR label for each status (the Sales-normal view shows these). */
export const DEFAULT_LABELS: Record<ItemStatus, Labels> = {
  REQUESTED: { en: "Requested", ar: "مطلوب" },
  ORDERED: { en: "Ordered", ar: "تم الطلب" },
  SHIPPED: { en: "Shipped", ar: "تم الشحن" },
  DELIVERED: { en: "Delivered", ar: "تم التسليم" },
  HUB: { en: "Hub", ar: "في المخزن" },
  TRANSIT: { en: "Transit", ar: "في الطريق" },
  GLOBAL_SHIPPING: { en: "Global Shipping", ar: "شحن دولي" },
  CUSTOMS: { en: "Customs", ar: "جمارك" },
  OUT_FOR_DELIVERY: { en: "Out for Delivery", ar: "خارج للتوصيل" },
  OFFICE: { en: "Office", ar: "المكتب" },
  PHOTOS_SENT: { en: "Photos Sent", ar: "تم إرسال الصور" },
  WEBSITE: { en: "Website", ar: "على الموقع" },
};

// ── Sales-facing views ────────────────────────────────────────────────────────
// Sales see ITEM statuses only (never container statuses). Two variants:
// - SALES_NORMAL: the full progression (light tracking in the UI).
// - SALES_SPECIAL: a sparser milestone view — at "carry-forward" steps Sales
//   keep showing the previous milestone instead of a new label.
export type SalesView = "SALES_NORMAL" | "SALES_SPECIAL";

/** Steps where each Sales view shows nothing new (carry the previous label). */
export const DEFAULT_CARRY_FORWARD: Record<SalesView, ItemStatus[]> = {
  SALES_NORMAL: [],
  SALES_SPECIAL: ["DELIVERED", "HUB", "TRANSIT", "CUSTOMS"],
};

// ── Container-status reference map (for the Status Map editor / later wiring) ──
// What each container column displays at each item step (from Status.xlsx).
// Informational here; the container modules consume it when built.
export type ContainerView = "PURCHASE" | "PATCH" | "HUB" | "TRANSFER" | "TRIP" | "SHIPMENT";
export const CONTAINER_VIEW_MAP: Partial<Record<ItemStatus, Partial<Record<ContainerView, string>>>> = {
  ORDERED: { PURCHASE: "New" },
  SHIPPED: { PURCHASE: "Dispatched", PATCH: "Dispatched" },
  DELIVERED: { PURCHASE: "Delivered", PATCH: "Delivered", HUB: "Delivered" },
  HUB: { PURCHASE: "Received", PATCH: "Received", HUB: "Received", TRIP: "Received" },
  CUSTOMS: { TRIP: "In Egypt" },
  OUT_FOR_DELIVERY: { TRIP: "Ready to pickup" },
  OFFICE: { TRIP: "Picked up", SHIPMENT: "Picked up" },
  PHOTOS_SENT: { TRIP: "Photos Sent", SHIPMENT: "Photos Sent" },
  WEBSITE: { TRIP: "Website", SHIPMENT: "Website" },
};

// ── Auto-advance timers (item status advances by a scheduled worker) ──────────
// Both clocks start at the moment the item is Received (status → HUB).
export interface TimerRange {
  min: number;
  max: number;
} // whole days
export const DEFAULT_TIMERS: { TRANSIT: TimerRange; GLOBAL_SHIPPING: TimerRange } = {
  TRANSIT: { min: 2, max: 4 },
  GLOBAL_SHIPPING: { min: 4, max: 6 },
};

// ── Exception pools (shared buckets; items remember their source container) ───
export const EXCEPTION_POOLS = ["LOST", "DAMAGED", "ERRANT", "DELAYED"] as const;
export type ExceptionPool = (typeof EXCEPTION_POOLS)[number];

// ── Admin overrides (decision "A") ────────────────────────────────────────────
export interface WorkflowOverrides {
  labels?: Partial<Record<ItemStatus, Partial<Labels>>>;
  carryForward?: Partial<Record<SalesView, ItemStatus[]>>;
  timers?: { TRANSIT?: TimerRange; GLOBAL_SHIPPING?: TimerRange };
}

export interface ResolvedWorkflow {
  /** Canonical label for a status (used by Sales-normal & internal displays). */
  label(status: ItemStatus, locale: Locale): string;
  /** Sales-facing label, applying special-order carry-forward. */
  salesLabel(status: ItemStatus, special: boolean, locale: Locale): string;
  carryForward: Record<SalesView, Set<ItemStatus>>;
  timers: { TRANSIT: TimerRange; GLOBAL_SHIPPING: TimerRange };
}

function isItemStatus(v: unknown): v is ItemStatus {
  return typeof v === "string" && (ITEM_STATUS_ORDER as string[]).includes(v);
}
function cleanRange(r: unknown, fallback: TimerRange): TimerRange {
  if (r && typeof r === "object") {
    const o = r as { min?: unknown; max?: unknown };
    const min = typeof o.min === "number" && o.min >= 0 ? Math.floor(o.min) : fallback.min;
    const max = typeof o.max === "number" && o.max >= min ? Math.floor(o.max) : Math.max(min, fallback.max);
    return { min, max };
  }
  return fallback;
}

/** Merge admin overrides over the in-code defaults into a resolved workflow. */
export function resolveWorkflow(overrides?: WorkflowOverrides | null): ResolvedWorkflow {
  const o = overrides ?? {};

  const labelFor = (status: ItemStatus, locale: Locale): string => {
    const ov = o.labels?.[status];
    return (locale === "ar" ? ov?.ar : ov?.en) || DEFAULT_LABELS[status][locale];
  };

  const carryForward: Record<SalesView, Set<ItemStatus>> = {
    SALES_NORMAL: new Set(
      (o.carryForward?.SALES_NORMAL ?? DEFAULT_CARRY_FORWARD.SALES_NORMAL).filter(isItemStatus),
    ),
    SALES_SPECIAL: new Set(
      (o.carryForward?.SALES_SPECIAL ?? DEFAULT_CARRY_FORWARD.SALES_SPECIAL).filter(isItemStatus),
    ),
  };

  const timers = {
    TRANSIT: cleanRange(o.timers?.TRANSIT, DEFAULT_TIMERS.TRANSIT),
    GLOBAL_SHIPPING: cleanRange(o.timers?.GLOBAL_SHIPPING, DEFAULT_TIMERS.GLOBAL_SHIPPING),
  };

  const salesLabel = (status: ItemStatus, special: boolean, locale: Locale): string => {
    const hidden = carryForward[special ? "SALES_SPECIAL" : "SALES_NORMAL"];
    const idx = ITEM_STATUS_ORDER.indexOf(status);
    for (let i = idx; i >= 0; i--) {
      const s = ITEM_STATUS_ORDER[i];
      if (!hidden.has(s)) return labelFor(s, locale);
    }
    return labelFor(status, locale); // all prior hidden — show own label
  };

  return { label: labelFor, salesLabel, carryForward, timers };
}

/**
 * Compute the auto-advance target dates from the Received time. `rand` returns
 * [0,1); injected for deterministic tests. Global Shipping is clamped to be
 * on/after Transit.
 */
export function autoAdvanceSchedule(
  receivedAt: Date,
  rand: () => number,
  timers: { TRANSIT: TimerRange; GLOBAL_SHIPPING: TimerRange } = DEFAULT_TIMERS,
): { transitAt: Date; globalShippingAt: Date } {
  const pick = (r: TimerRange) => r.min + Math.floor(rand() * (r.max - r.min + 1));
  const base = receivedAt.getTime();
  const day = 86_400_000;
  const transitDays = pick(timers.TRANSIT);
  const globalDays = Math.max(pick(timers.GLOBAL_SHIPPING), transitDays);
  return {
    transitAt: new Date(base + transitDays * day),
    globalShippingAt: new Date(base + globalDays * day),
  };
}
