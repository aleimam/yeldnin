import "server-only";
import { prisma } from "@/lib/db";
import type { AccessLike } from "@/lib/products/products-logic";
import { deliveryCourierFilter, isDeliveryStatus, isBounceTransition, isTerminal, collectionMismatch } from "@/lib/deliveries/deliveries-logic";

/**
 * Delivery reads. Every list and lookup here goes through `scopeWhere`, which
 * applies the courier restriction SERVER-SIDE.
 *
 * GOLDEN RULE (DELIVERIES §5.1): YeldnIN permissions are per-module with no
 * row-level concept, so a courier holding VIEW the ordinary way would otherwise
 * see every customer's address, phone and cash amount in the system. Ops see
 * everything; a courier sees only their own — and the by-id path is the one that
 * gets abused, so `getDeliveryFor` applies the same filter rather than trusting
 * that nobody will guess an id.
 */

/** The courier a user is on the roster as, if any. */
export async function courierIdForUser(userId: number): Promise<number | null> {
  const c = await prisma.courier.findUnique({ where: { userId }, select: { id: true } });
  return c?.id ?? null;
}

function scopeWhere(access: AccessLike, tier: string, ownCourierId: number | null) {
  const courierId = deliveryCourierFilter(access, tier, ownCourierId);
  // null = Ops/admin, unfiltered. A number pins to that courier; -1 deliberately
  // matches nothing (a THIRD_PARTY courier who is not on the roster sees zero).
  return courierId == null ? {} : { courierId };
}

export interface DeliveryListOpts {
  search?: string;
  status?: string;
  skip?: number;
  take?: number;
}

export async function listDeliveriesPaged(access: AccessLike, tier: string, ownCourierId: number | null, opts: DeliveryListOpts) {
  const where = {
    archivedAt: null,
    ...scopeWhere(access, tier, ownCourierId),
    ...(isDeliveryStatus(opts.status) ? { status: opts.status } : {}),
    ...(opts.search
      ? {
          OR: [
            { uid: { contains: opts.search } },
            { orderNumber: { contains: opts.search } },
            { customerName: { contains: opts.search } },
            { customerPhone: { contains: opts.search } },
            { addressZone: { contains: opts.search } },
          ],
        }
      : {}),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.delivery.findMany({
      where,
      // Undated deliveries sort last, then soonest promise first: the list is a
      // work queue, not an audit log.
      orderBy: [{ promisedDate: "asc" }, { createdAt: "desc" }],
      skip: opts.skip ?? 0,
      take: opts.take ?? 50,
      select: {
        id: true,
        uid: true,
        orderNumber: true,
        status: true,
        customerName: true,
        addressZone: true,
        promisedDate: true,
        promisedSlot: true,
        collectPiastres: true,
        paymentMethod: true,
        reviewFlag: true,
        bounceCount: true,
        courier: { select: { id: true, name: true } },
      },
    }),
    prisma.delivery.count({ where }),
  ]);
  return { rows, total };
}

/** By-id read, scoped. Returns null for someone else's delivery so the caller
 *  can 404 — NOT 403, which would confirm the delivery exists. */
export async function getDeliveryFor(access: AccessLike, tier: string, ownCourierId: number | null, id: number) {
  return prisma.delivery.findFirst({
    where: { id, archivedAt: null, ...scopeWhere(access, tier, ownCourierId) },
    include: {
      lines: true,
      photos: { select: { id: true, assetId: true } },
      courier: { select: { id: true, name: true } },
      events: { orderBy: { at: "desc" }, take: 50 },
    },
  });
}

/** Counts per status for the queue tabs — same scoping as the list. */
export async function deliveryStatusCounts(access: AccessLike, tier: string, ownCourierId: number | null) {
  const rows = await prisma.delivery.groupBy({
    by: ["status"],
    where: { archivedAt: null, ...scopeWhere(access, tier, ownCourierId) },
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((r) => [r.status, r._count._all])) as Record<string, number>;
}

// ── Writes ─────────────────────────────────────────────────────────────────

export interface StatusChangeInput {
  to: string;
  courierId?: number | null;
  failureReason?: string | null;
  cancelReason?: string | null;
  promisedDate?: string | null;
  promisedSlot?: string | null;
  collectedPiastres?: number | null;
  note?: string | null;
  reviewFlag?: boolean;
  reviewNote?: string | null;
}

/**
 * Apply a validated status change. The CALLER must already have loaded the
 * delivery through `getDeliveryFor` (so the courier scope is proven) and run
 * `validateStatusChange` — this function trusts neither the id nor the payload
 * on its own, it only writes.
 *
 * One transaction so the delivery row and its event can never disagree: a status
 * with no event is an untraceable change, and an event with no status is a lie.
 */
export async function applyStatusChange(
  current: { id: number; status: string; bounceCount: number; collectPiastres: number },
  input: StatusChangeInput,
  userId: number,
) {
  const bounced = isBounceTransition(current.status, input.to);
  const closing = isTerminal(input.to);
  // A courier handing over a different amount than the order says is the
  // commonest Yellow Flag trigger — raise it automatically rather than relying
  // on someone remembering to tick a box. An explicit flag still wins.
  const mismatch = input.to === "DELIVERED" && collectionMismatch(current.collectPiastres, input.collectedPiastres ?? null);
  const at = new Date();

  return prisma.$transaction(async (tx) => {
    const d = await tx.delivery.update({
      where: { id: current.id },
      data: {
        status: input.to,
        ...(input.courierId !== undefined ? { courierId: input.courierId } : {}),
        ...(input.promisedDate ? { promisedDate: new Date(input.promisedDate) } : {}),
        ...(input.promisedSlot ? { promisedSlot: input.promisedSlot } : {}),
        // Reasons are cleared on any move that doesn't carry one, so a retried
        // delivery cannot keep displaying why a PREVIOUS attempt failed.
        failureReason: input.to === "FAILED" ? (input.failureReason ?? null) : null,
        cancelReason: input.to === "CANCELLED" ? (input.cancelReason ?? null) : null,
        ...(input.collectedPiastres != null ? { collectedPiastres: input.collectedPiastres } : {}),
        ...(input.note ? { courierNote: input.note } : {}),
        ...(bounced ? { bounceCount: { increment: 1 } } : {}),
        ...(input.to === "DELIVERED" ? { deliveredAt: at } : {}),
        ...(closing ? { closedAt: at } : {}),
        ...(input.reviewFlag || mismatch ? { reviewFlag: true, reviewNote: input.reviewNote ?? null } : {}),
        updatedById: userId,
      },
    });
    await tx.deliveryEvent.create({
      data: {
        deliveryId: current.id,
        status: input.to,
        at,
        byUserId: userId,
        reason: input.failureReason ?? input.cancelReason ?? null,
        note: input.note ?? null,
      },
    });
    return d;
  });
}

/** Active couriers for the assignment picker. */
export function listCouriersForAssignment() {
  return prisma.courier.findMany({
    where: { archivedAt: null, active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

/** Raise or clear the Yellow Flag on its own, without a status change. */
export async function setReviewFlag(id: number, flag: boolean, note: string | null, userId: number) {
  return prisma.delivery.update({
    where: { id },
    data: { reviewFlag: flag, reviewNote: flag ? note : null, updatedById: userId },
  });
}
