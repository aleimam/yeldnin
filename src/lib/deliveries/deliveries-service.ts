import "server-only";
import { prisma } from "@/lib/db";
import type { AccessLike } from "@/lib/products/products-logic";
import { deliveryCourierFilter, isDeliveryStatus } from "@/lib/deliveries/deliveries-logic";

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

function scopeWhere(ownCourierId: number | null, access: AccessLike) {
  const courierId = deliveryCourierFilter(access, ownCourierId);
  // null = Ops/admin, unfiltered. A number pins to that courier; -1 deliberately
  // matches nothing (a VIEW-level user who is not on the roster sees zero).
  return courierId == null ? {} : { courierId };
}

export interface DeliveryListOpts {
  search?: string;
  status?: string;
  skip?: number;
  take?: number;
}

export async function listDeliveriesPaged(access: AccessLike, ownCourierId: number | null, opts: DeliveryListOpts) {
  const where = {
    archivedAt: null,
    ...scopeWhere(ownCourierId, access),
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
export async function getDeliveryFor(access: AccessLike, ownCourierId: number | null, id: number) {
  return prisma.delivery.findFirst({
    where: { id, archivedAt: null, ...scopeWhere(ownCourierId, access) },
    include: {
      lines: true,
      photos: { select: { id: true, assetId: true } },
      courier: { select: { id: true, name: true } },
      events: { orderBy: { at: "desc" }, take: 50 },
    },
  });
}

/** Counts per status for the queue tabs — same scoping as the list. */
export async function deliveryStatusCounts(access: AccessLike, ownCourierId: number | null) {
  const rows = await prisma.delivery.groupBy({
    by: ["status"],
    where: { archivedAt: null, ...scopeWhere(ownCourierId, access) },
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((r) => [r.status, r._count._all])) as Record<string, number>;
}
