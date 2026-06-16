import "server-only";
import { prisma } from "@/lib/db";
import { nextUid } from "@/lib/uid";
import { moveItems, itemsInContainerHistory } from "@/lib/items/items-service";
import { nextTripStatus, TRIP_TO_ITEM_STATUS, isTripPurchaseEligible, type TripStatus } from "./trip-logic";

export interface CreateTripInput {
  travelerId: number;
  country: string;
  maxWeight?: number | null;
  dealPricePerKg?: number | null;
  lastReceivingDate?: string | null;
  deliveryDateInEgypt?: string | null;
  notes?: string | null;
}

/** Create a trip, inheriting allowed types / male-support / notes from the traveler. */
export async function createTrip(input: CreateTripInput, userId: number) {
  const traveler = await prisma.traveler.findUnique({ where: { id: input.travelerId } });
  if (!traveler) throw new Error("Traveler not found.");
  const uid = await nextUid("TRP");
  return prisma.trip.create({
    data: {
      uid,
      travelerId: input.travelerId,
      country: input.country.trim(),
      maxWeight: input.maxWeight ?? null,
      dealPricePerKg: input.dealPricePerKg ?? null,
      lastReceivingDate: input.lastReceivingDate ? new Date(input.lastReceivingDate) : null,
      deliveryDateInEgypt: input.deliveryDateInEgypt ? new Date(input.deliveryDateInEgypt) : null,
      allowedProductTypes: traveler.allowedProductTypes,
      maleSupport: traveler.carriesMaleSupport,
      notes: input.notes?.trim() || traveler.notes,
      createdById: userId,
    },
  });
}

/** Advance a trip to the next status; cascade item statuses where the map says so. */
export async function advanceTrip(id: number, userId: number) {
  const trip = await prisma.trip.findUnique({ where: { id } });
  if (!trip) return;
  const next = nextTripStatus(trip.status);
  if (!next) return;
  await prisma.trip.update({ where: { id }, data: { status: next, updatedById: userId } });
  const itemStatus = TRIP_TO_ITEM_STATUS[next as TripStatus];
  if (itemStatus) {
    const items = await prisma.item.findMany({
      where: { containerType: "TRIP", containerId: id, exceptionFlag: null },
      select: { id: true },
    });
    await moveItems(items.map((i) => i.id), { status: itemStatus, action: `trip:${next}` }, userId);
  }
}

export function listTrips() {
  return prisma.trip.findMany({
    where: { archivedAt: null },
    orderBy: { createdAt: "desc" },
    include: { traveler: { select: { name: true } } },
    take: 200,
  });
}
export function getTrip(id: number) {
  return prisma.trip.findFirst({ where: { id, archivedAt: null }, include: { traveler: { select: { id: true, name: true } } } });
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
      name: `${tr.traveler.name} · ${tr.country}${tr.lastReceivingDate ? " · " + tr.lastReceivingDate.toISOString().slice(0, 10) : ""}`,
    }));
}
