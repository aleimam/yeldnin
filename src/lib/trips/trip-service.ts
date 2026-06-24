import "server-only";
import { prisma } from "@/lib/db";
import { nextUid } from "@/lib/uid";
import { formatBizDate } from "@/lib/format/dates";
import { joinTypes } from "@/lib/travelers/travelers-logic";
import { moveItems, itemsInContainerHistory } from "@/lib/items/items-service";
import { MOVABLE_ITEMS_WHERE } from "@/lib/items/items-logic";
import { nextTripStatus, TRIP_TO_ITEM_STATUS, isTripPurchaseEligible, canManuallyAdvance, type TripStatus } from "./trip-logic";
import { attachHoldingToTrip, fallTripItemsToHolding } from "@/lib/transfers/transfer-service";

export interface CreateTripInput {
  travelerId: number;
  country: string;
  maxWeight?: number | null;
  dealPricePerKg?: number | null;
  lastReceivingDate?: string | null;
  deliveryDateInEgypt?: string | null;
  notes?: string | null;
  allowedProductTypes?: string[];
  handlingFee?: number | null;
  handlingFeeCurrency?: string | null;
}

/** Create a trip, inheriting allowed types / male-support / notes from the traveler. */
export async function createTrip(input: CreateTripInput, userId: number) {
  const traveler = await prisma.traveler.findUnique({ where: { id: input.travelerId } });
  if (!traveler) throw new Error("Traveler not found.");
  const uid = await nextUid("TRP");
  const trip = await prisma.trip.create({
    data: {
      uid,
      travelerId: input.travelerId,
      country: input.country.trim(),
      maxWeight: input.maxWeight ?? null,
      dealPricePerKg: input.dealPricePerKg ?? null,
      lastReceivingDate: input.lastReceivingDate ? new Date(input.lastReceivingDate) : null,
      deliveryDateInEgypt: input.deliveryDateInEgypt ? new Date(input.deliveryDateInEgypt) : null,
      allowedProductTypes: input.allowedProductTypes?.length ? joinTypes(input.allowedProductTypes) : traveler.allowedProductTypes,
      maleSupport: traveler.carriesMaleSupport,
      notes: input.notes?.trim() || traveler.notes,
      handlingFee: input.handlingFee ?? null,
      handlingFeeCurrency: input.handlingFeeCurrency ?? null,
      createdById: userId,
    },
  });
  // The traveler's held inventory auto-attaches to their new trip (shared inventory).
  await attachHoldingToTrip(trip.travelerId, trip.id, userId);
  return trip;
}

/** Edit a trip's details (creator/admin gated in the action). Status is untouched. */
export async function updateTrip(id: number, input: CreateTripInput, userId: number) {
  return prisma.trip.update({
    where: { id },
    data: {
      travelerId: input.travelerId,
      country: input.country.trim(),
      maxWeight: input.maxWeight ?? null,
      dealPricePerKg: input.dealPricePerKg ?? null,
      lastReceivingDate: input.lastReceivingDate ? new Date(input.lastReceivingDate) : null,
      deliveryDateInEgypt: input.deliveryDateInEgypt ? new Date(input.deliveryDateInEgypt) : null,
      allowedProductTypes: input.allowedProductTypes?.length ? joinTypes(input.allowedProductTypes) : "",
      notes: input.notes?.trim() || null,
      handlingFee: input.handlingFee ?? null,
      handlingFeeCurrency: input.handlingFeeCurrency ?? null,
      updatedById: userId,
    },
  });
}

/** Advance a trip to the next status; cascade item statuses where the map says so. */
export async function advanceTrip(id: number, userId: number) {
  const trip = await prisma.trip.findUnique({ where: { id } });
  if (!trip || !canManuallyAdvance(trip.status)) return;
  const next = nextTripStatus(trip.status);
  if (!next) return;
  await prisma.trip.update({ where: { id }, data: { status: next, updatedById: userId } });
  const itemStatus = TRIP_TO_ITEM_STATUS[next as TripStatus];
  if (itemStatus) {
    const items = await prisma.item.findMany({
      where: { containerType: "TRIP", containerId: id, ...MOVABLE_ITEMS_WHERE },
      select: { id: true },
    });
    await moveItems(items.map((i) => i.id), { status: itemStatus, action: `trip:${next}` }, userId);
  }
}

/** Admin gate on a NEW trip: approve (→ Approved) or deny (→ Cancelled). */
export async function approveTrip(id: number, userId: number) {
  const trip = await prisma.trip.findUnique({ where: { id }, select: { status: true } });
  if (trip?.status !== "NEW") return;
  await prisma.trip.update({ where: { id }, data: { status: "APPROVED", updatedById: userId } });
}
export async function denyTrip(id: number, userId: number) {
  const trip = await prisma.trip.findUnique({ where: { id }, select: { status: true } });
  if (trip?.status !== "NEW") return;
  await prisma.trip.update({ where: { id }, data: { status: "CANCELLED", updatedById: userId } });
  // Cancelled trip → its un-flagged + delayed items fall back to the traveler's holding.
  await fallTripItemsToHolding(id, userId);
}

/** First purchase placed to an Approved trip auto-advances it to Started Shipping. */
export async function startTripShippingIfApproved(tripId: number, userId: number) {
  await prisma.trip.updateMany({
    where: { id: tripId, status: "APPROVED" },
    data: { status: "STARTED_SHIPPING", updatedById: userId },
  });
}

/** Trips ordered nearest-first: soonest upcoming last-receiving date first, then
 *  past / undated trips (createdAt-desc within that tail). */
export async function listTrips() {
  const trips = await prisma.trip.findMany({
    where: { archivedAt: null },
    orderBy: { createdAt: "desc" },
    include: { traveler: { select: { name: true } } },
    take: 200,
  });
  return sortNearestFirst(trips);
}

/** Nearest-first: soonest upcoming last-receiving date first; past/undated sink to
 *  the tail (keeping the incoming createdAt-desc order among them). */
function sortNearestFirst<T extends { lastReceivingDate: Date | null }>(trips: T[]): T[] {
  const now = Date.now();
  const key = (d: Date | null) => {
    if (!d) return Infinity;
    const ts = d.getTime();
    return ts >= now ? ts : Infinity; // past receiving dates sink to the end
  };
  return trips.sort((a, b) => key(a.lastReceivingDate) - key(b.lastReceivingDate));
}

/** Paginated + filtered trips. The nearest-first ordering is computed in JS, so we
 *  fetch the filtered set, sort, then slice the page; heavy per-row aggregates are
 *  then computed only for the visible page. */
export async function listTripsPaged(opts: {
  search?: string;
  status?: string;
  sort?: string;
  skip?: number;
  take?: number;
}) {
  const where = {
    archivedAt: null,
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.search
      ? {
          OR: [
            { uid: { contains: opts.search } },
            { country: { contains: opts.search } },
            { traveler: { name: { contains: opts.search } } },
          ],
        }
      : {}),
  };
  const trips = await prisma.trip.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { traveler: { select: { name: true } } },
  });
  const ordered = opts.sort === "newest" ? trips : sortNearestFirst(trips);
  const skip = opts.skip ?? 0;
  const take = opts.take ?? 50;
  return { rows: ordered.slice(skip, skip + take), total: ordered.length };
}
export function listTripsByTraveler(travelerId: number) {
  return prisma.trip.findMany({
    where: { travelerId, archivedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, uid: true, status: true, country: true, lastReceivingDate: true },
  });
}
export function getTrip(id: number) {
  return prisma.trip.findFirst({
    where: { id, archivedAt: null },
    include: { traveler: { select: { id: true, name: true } }, _count: { select: { shipments: true } } },
  });
}
export function getTripItems(tripId: number) {
  return itemsInContainerHistory("TRIP", tripId);
}

/** Trips a purchase can target right now (Approved/Started Shipping + future date). */
export async function eligibleTripsForPurchase() {
  const trips = await prisma.trip.findMany({
    where: { archivedAt: null, status: { in: ["APPROVED", "STARTED_SHIPPING"] } },
    include: { traveler: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  const now = new Date();
  return trips
    .filter((tr) => isTripPurchaseEligible(tr, now))
    .map((tr) => ({
      id: tr.id,
      name: `${tr.traveler.name} · ${tr.lastReceivingDate ? formatBizDate(tr.lastReceivingDate) : "—"}`,
      country: tr.country,
    }));
}
