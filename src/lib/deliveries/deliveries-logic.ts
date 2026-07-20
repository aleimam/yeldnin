// Pure delivery logic. No DB/IO. Unit-tested.
// Contract: INTEGRATION_V2_DELIVERIES.md (a Delivery is an order going OUT to a
// customer by our own courier — never call it a "shipment").
import type { Level } from "@/lib/auth/access-logic";
import type { AccessLike } from "@/lib/products/products-logic";

/** The module key stays `couriers` even though the module is LABELLED
 *  "Deliveries": permissions are keyed by module in `UserModulePermission`, so
 *  renaming the key would void every existing grant. Same precedent as
 *  `sla.egv` displaying as "Veeey". */
export const DELIVERIES_MODULE = "couriers";

export const DELIVERY_STATUSES = [
  "NEW", // exists, no courier chosen yet
  "ASSIGNED", // a courier has it — NOT yet visible to the customer as "out"
  "OUT_FOR_DELIVERY", // he has actually left
  "DELIVERED",
  "RESCHEDULED", // the CUSTOMER asked for another time
  "DELAYED", // the COURIER didn't make it
  "FAILED",
  "CANCELLED",
] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];
export function isDeliveryStatus(v: unknown): v is DeliveryStatus {
  return typeof v === "string" && (DELIVERY_STATUSES as readonly string[]).includes(v);
}

/**
 * Why a courier could not complete an attempt. Codes, never free text — free
 * text does not aggregate, and the whole point of separating these from
 * CANCELLED is to be able to count them.
 *
 * `REFUSED` is deliberately absent: a customer refusing at the door DECLINED,
 * which is CANCELLED. `NO_CASH` earns its own code because it is a common COD
 * outcome that fits none of the others.
 */
export const FAILURE_REASONS = ["NOT_HOME", "UNREACHABLE", "WRONG_ADDRESS", "NO_CASH", "DAMAGED", "OTHER"] as const;
export type FailureReason = (typeof FAILURE_REASONS)[number];
export function isFailureReason(v: unknown): v is FailureReason {
  return typeof v === "string" && (FAILURE_REASONS as readonly string[]).includes(v);
}

/** Fixed 4-hour windows. Fixed slots beat free times: a predictable promise for
 *  the customer, batchable routes for Ops, and ONE enum to validate instead of
 *  two independently-wrong timestamps. */
export const DELIVERY_SLOTS = ["10:00-14:00", "14:00-18:00", "18:00-22:00"] as const;
export type DeliverySlot = (typeof DELIVERY_SLOTS)[number];
export function isDeliverySlot(v: unknown): v is DeliverySlot {
  return typeof v === "string" && (DELIVERY_SLOTS as readonly string[]).includes(v);
}

export const PAYMENT_METHODS = ["COD", "PREPAID"] as const;
export function isPaymentMethod(v: unknown): v is (typeof PAYMENT_METHODS)[number] {
  return typeof v === "string" && (PAYMENT_METHODS as readonly string[]).includes(v);
}

/** DELIVERED, FAILED and CANCELLED are final — a delivery that has stopped
 *  moving never moves again. Reopening is a new delivery, not a state change. */
export function isTerminal(status: string): boolean {
  return status === "DELIVERED" || status === "FAILED" || status === "CANCELLED";
}

/** Non-terminal slippage: the delivery is still alive and will be attempted again. */
export function isBouncing(status: string): boolean {
  return status === "RESCHEDULED" || status === "DELAYED";
}

const TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
  NEW: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["OUT_FOR_DELIVERY", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "RESCHEDULED", "DELAYED", "FAILED", "CANCELLED"],
  RESCHEDULED: ["OUT_FOR_DELIVERY", "FAILED", "CANCELLED"],
  DELAYED: ["OUT_FOR_DELIVERY", "FAILED", "CANCELLED"],
  DELIVERED: [],
  FAILED: [],
  CANCELLED: [],
};

/**
 * Is `to` reachable from `from`?
 *
 * Note `NEW → CANCELLED` is allowed. §2.2 of the contract lists cancellation as
 * accepted "while ASSIGNED or OUT_FOR_DELIVERY", but a delivery whose order is
 * cancelled BEFORE anyone assigns a courier is the easiest case of all, and
 * without this edge it would be stuck in NEW forever with no legal exit.
 */
export function canTransition(from: string, to: string): boolean {
  if (!isDeliveryStatus(from) || !isDeliveryStatus(to)) return false;
  return TRANSITIONS[from].includes(to);
}

/** The transition that counts as a retry: back out on the road after slipping. */
export function isBounceTransition(from: string, to: string): boolean {
  return isBouncing(from) && to === "OUT_FOR_DELIVERY";
}

/** Suggested, not enforced — humans close a delivery, not a counter. Past this
 *  many retries Ops get a visible nudge so one cannot quietly cycle for weeks. */
export const BOUNCE_ATTENTION_THRESHOLD = 3;
export function needsAttention(bounceCount: number): boolean {
  return bounceCount >= BOUNCE_ATTENTION_THRESHOLD;
}

/** FAILED must say why — that code is the entire reason FAILED is separate from
 *  CANCELLED. Everything else must NOT carry one. */
export function requiresFailureReason(status: string): boolean {
  return status === "FAILED";
}

/** Validate a status change end-to-end. Returns a field→message map, empty when OK. */
export function validateStatusChange(input: {
  from: string;
  to: string;
  failureReason?: string | null;
  promisedDate?: string | null;
  promisedSlot?: string | null;
  courierId?: number | null;
}): Record<string, string> {
  const e: Record<string, string> = {};
  if (!canTransition(input.from, input.to)) {
    e.status = isTerminal(input.from) ? "This delivery is already closed." : "That status change isn't allowed.";
    return e; // no point validating the details of an impossible move
  }
  if (requiresFailureReason(input.to) && !isFailureReason(input.failureReason)) {
    e.failureReason = "Choose why the attempt failed.";
  }
  if (!requiresFailureReason(input.to) && input.failureReason) {
    e.failureReason = "Only a failed attempt carries a reason.";
  }
  // A courier who reschedules is making a NEW promise — an unchanged one is the
  // commonest way a reschedule becomes meaningless to the customer.
  if (isBouncing(input.to)) {
    if (!input.promisedDate) e.promisedDate = "Set the new promised date.";
    if (!isDeliverySlot(input.promisedSlot)) e.promisedSlot = "Choose a 4-hour slot.";
  }
  if (input.to === "ASSIGNED" && !input.courierId) e.courierId = "Choose a courier.";
  if (input.promisedSlot && !isDeliverySlot(input.promisedSlot)) e.promisedSlot = "Choose a 4-hour slot.";
  return e;
}

// ── Money ──────────────────────────────────────────────────────────────────
// Stored in PIASTRES (integer minor unit). Cash a courier physically counts must
// not inherit binary-float rounding, so it never becomes a Float on our side.

export function piastresToEgp(p: number | null | undefined): number | null {
  return typeof p === "number" && Number.isFinite(p) ? p / 100 : null;
}
export function egpToPiastres(egp: number | null | undefined): number | null {
  return typeof egp === "number" && Number.isFinite(egp) ? Math.round(egp * 100) : null;
}

/** Nothing to collect: prepaid orders, or a COD order already settled. */
export function isPrepaid(collectPiastres: number, paymentMethod: string): boolean {
  return paymentMethod === "PREPAID" || collectPiastres <= 0;
}

/**
 * Did the courier hand over a different amount than the order says?
 *
 * This is the commonest trigger for the Yellow Flag (§3): a shortfall means the
 * customer took part of the order, or haggled, or the order itself is wrong.
 * The sync NEVER edits the order — a human decides what it should say.
 */
export function collectionMismatch(expectedPiastres: number, collectedPiastres: number | null): boolean {
  if (collectedPiastres == null) return false;
  return collectedPiastres !== expectedPiastres;
}

// ── Access (golden rule) ───────────────────────────────────────────────────

/**
 * YeldnIN permissions are per-MODULE with no notion of "only your own rows", so
 * a courier given VIEW the ordinary way would see every customer's address,
 * phone and cash amount in the system. Ops see all deliveries; a courier sees
 * ONLY their own — enforced by query filter and by 404 on the by-id path, never
 * by hiding a link.
 *
 * Within their own deliveries a courier sees EVERYTHING — address, phone, lines,
 * COD amount. The restriction is *which* deliveries, never *how much* of one.
 */
export function canSeeAllDeliveries(a: AccessLike): boolean {
  return a.isAdmin || a.canModule(DELIVERIES_MODULE, "OPERATE");
}

/** Which courier's rows this user may see; null = all of them (Ops/admin). */
export function deliveryCourierFilter(a: AccessLike, ownCourierId: number | null): number | null {
  if (canSeeAllDeliveries(a)) return null;
  return ownCourierId ?? -1; // -1 matches nothing: a non-Ops user off the roster sees zero, not everything
}

export function canViewDeliveries(a: AccessLike, level: Level = "VIEW"): boolean {
  return a.isAdmin || a.canModule(DELIVERIES_MODULE, level);
}
