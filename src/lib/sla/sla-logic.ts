// Special-order delivery SLA — pure logic (unit-tested). The service layer
// (sla-config-service / sla-service) supplies config + Prisma data; everything
// here is deterministic given its inputs.
//
// Grace periods (admin-editable, per scope): the customer guarantee is the order
// date + grace days. Source class decides which grace applies — an INJECTION
// product always wins (longest), otherwise the supplier's SLA class.
//
//   Injection → 40d · Standard sources → 30d · Fast retailers → 20d   (defaults)
//
// Promised = createdAt + grace (frozen at creation). Expected = the carrying
// trip's delivery date, or the promise itself before a trip is assigned. Status
// compares expected/now against the promise, with an admin-set risk window.

/** Supplier delivery class (set per supplier in the admin). */
export const SLA_CLASSES = ["STANDARD", "FAST"] as const;
export type SlaClass = (typeof SLA_CLASSES)[number];

/** Resolved source class for an item (injection beats the supplier class). */
export type SourceClass = "INJECTION" | "STANDARD" | "FAST";

export type SlaStatus = "HEALTHY" | "RISK" | "DELAYED" | "DELIVERED";

export interface ScopeGrace {
  injection: number;
  standard: number;
  fast: number;
}

export interface SlaSettings {
  egv: ScopeGrace;
  xoonx: ScopeGrace;
  riskWindowDays: number;
  /** Special-order deposit as a % of the order's total selling value. */
  depositPct: number;
}

/** What may be stored (any subset, possibly stale) — merged over defaults. */
export interface SlaSettingsInput {
  egv?: Partial<ScopeGrace>;
  xoonx?: Partial<ScopeGrace>;
  riskWindowDays?: number;
  depositPct?: number;
}

export const DEFAULT_SLA: SlaSettings = {
  egv: { injection: 40, standard: 30, fast: 20 },
  xoonx: { injection: 40, standard: 30, fast: 20 },
  riskWindowDays: 5,
  depositPct: 25,
};

const DAY_MS = 86_400_000;

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : fallback;
}

function mergeGrace(raw: Partial<ScopeGrace> | undefined, def: ScopeGrace): ScopeGrace {
  return {
    injection: num(raw?.injection, def.injection),
    standard: num(raw?.standard, def.standard),
    fast: num(raw?.fast, def.fast),
  };
}

/** Merge a stored (possibly partial) config over the defaults. Tolerant of junk. */
export function resolveSla(raw?: SlaSettingsInput | null): SlaSettings {
  return {
    egv: mergeGrace(raw?.egv, DEFAULT_SLA.egv),
    xoonx: mergeGrace(raw?.xoonx, DEFAULT_SLA.xoonx),
    riskWindowDays: num(raw?.riskWindowDays, DEFAULT_SLA.riskWindowDays),
    depositPct: num(raw?.depositPct, DEFAULT_SLA.depositPct),
  };
}

/** Add whole days to a date (DST-agnostic, ms arithmetic). */
export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

/** Which grace bucket applies: injection product wins; else the supplier class. */
export function sourceClass(
  productType?: string | null,
  supplierSlaClass?: string | null,
): SourceClass {
  if ((productType ?? "").toUpperCase() === "INJECTION") return "INJECTION";
  return (supplierSlaClass ?? "").toUpperCase() === "FAST" ? "FAST" : "STANDARD";
}

/** Grace days for a scope + source class. */
export function graceDays(scope: string, source: SourceClass, sla: SlaSettings): number {
  const g = scope === "XOONX" ? sla.xoonx : sla.egv;
  return source === "INJECTION" ? g.injection : source === "FAST" ? g.fast : g.standard;
}

/** The customer guarantee date. */
export function promisedDate(createdAt: Date, grace: number): Date {
  return addDays(createdAt, grace);
}

/** Expected delivery: the trip's date once assigned, else the promise itself. */
export function expectedDate(promised: Date, tripDeliveryAt?: Date | null): Date {
  return tripDeliveryAt ?? promised;
}

/**
 * Healthy / Risk / Delayed. A delivered item is judged on its actual date.
 * Otherwise: overdue or a trip arriving past the promise → Delayed; the promise
 * approaching within the risk window, or a trip arriving with < risk-window
 * margin → Risk; otherwise Healthy. Before a trip exists only time-to-promise
 * drives Risk, so a fresh order with plenty of runway stays Healthy.
 */
export function slaStatus(args: {
  promised: Date;
  now: Date;
  riskWindowDays: number;
  tripDeliveryAt?: Date | null;
  deliveredAt?: Date | null;
}): SlaStatus {
  const { promised, now, riskWindowDays, tripDeliveryAt, deliveredAt } = args;
  if (deliveredAt) return deliveredAt.getTime() > promised.getTime() ? "DELAYED" : "DELIVERED";
  if (now.getTime() > promised.getTime()) return "DELAYED";
  if (tripDeliveryAt && tripDeliveryAt.getTime() > promised.getTime()) return "DELAYED";

  const windowMs = riskWindowDays * DAY_MS;
  const nearDeadline = promised.getTime() - now.getTime() <= windowMs;
  const tightTrip = tripDeliveryAt != null && promised.getTime() - tripDeliveryAt.getTime() <= windowMs;
  return nearDeadline || tightTrip ? "RISK" : "HEALTHY";
}

/** End-to-end SLA for one item from plain values. */
export function computeItemSla(args: {
  scope: string;
  productType?: string | null;
  supplierSlaClass?: string | null;
  createdAt: Date;
  promisedAt?: Date | null; // stored snapshot (preferred over recomputing)
  tripDeliveryAt?: Date | null;
  deliveredAt?: Date | null;
  now: Date;
  sla: SlaSettings;
}): { source: SourceClass; grace: number; promised: Date; expected: Date; status: SlaStatus } {
  const source = sourceClass(args.productType, args.supplierSlaClass);
  const grace = graceDays(args.scope, source, args.sla);
  const promised = args.promisedAt ?? promisedDate(args.createdAt, grace);
  const expected = expectedDate(promised, args.tripDeliveryAt);
  const status = slaStatus({
    promised,
    now: args.now,
    riskWindowDays: args.sla.riskWindowDays,
    tripDeliveryAt: args.tripDeliveryAt,
    deliveredAt: args.deliveredAt,
  });
  return { source, grace, promised, expected, status };
}
