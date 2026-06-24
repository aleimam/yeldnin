import "server-only";
import { prisma } from "@/lib/db";
import { clean } from "@/lib/text";
import { nextUid } from "@/lib/uid";
import { joinTypes } from "./travelers-logic";

export interface TravelerInput {
  name: string;
  contact?: string | null;
  notes?: string | null;
  referenceTravelerId?: number | null;
  blacklisted: boolean;
  staticAddress: boolean;
  carriesMaleSupport: boolean;
  allowedProductTypes: string[];
}

export function listTravelers() {
  return prisma.traveler.findMany({
    where: { archivedAt: null },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { photos: true } } },
    take: 200,
  });
}

export interface TravelerStats {
  tripCount: number;
  itemCount: number;
  nextTrip: Date | null;
  tripIds: number[];
}

/**
 * Travelers list with derived stats: number of (non-archived) trips, items
 * currently with the traveler (sitting in any of their trips), and the nearest
 * upcoming receiving date. `tripIds` lets the page roll up per-trip SLA.
 */
export async function listTravelersWithStats(now: Date = new Date()) {
  const travelers = await prisma.traveler.findMany({
    where: { archivedAt: null },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { photos: true } } },
    take: 200,
  });
  const ids = travelers.map((t) => t.id);
  const stats = new Map<number, TravelerStats>();
  for (const id of ids) stats.set(id, { tripCount: 0, itemCount: 0, nextTrip: null, tripIds: [] });
  if (ids.length) {
    const trips = await prisma.trip.findMany({
      where: { travelerId: { in: ids }, archivedAt: null },
      select: { id: true, travelerId: true, lastReceivingDate: true, status: true },
    });
    const tripIds = trips.map((t) => t.id);
    const items = tripIds.length
      ? await prisma.item.findMany({
          where: { containerType: "TRIP", containerId: { in: tripIds } },
          select: { containerId: true },
        })
      : [];
    const itemByTrip = new Map<number, number>();
    for (const it of items) if (it.containerId != null) itemByTrip.set(it.containerId, (itemByTrip.get(it.containerId) ?? 0) + 1);
    for (const tr of trips) {
      const s = stats.get(tr.travelerId);
      if (!s) continue;
      s.tripCount++;
      s.tripIds.push(tr.id);
      s.itemCount += itemByTrip.get(tr.id) ?? 0;
      if (tr.lastReceivingDate && tr.status !== "CANCELLED") {
        const ts = tr.lastReceivingDate.getTime();
        if (ts >= now.getTime() && (!s.nextTrip || ts < s.nextTrip.getTime())) s.nextTrip = tr.lastReceivingDate;
      }
    }
  }
  return travelers.map((tv) => ({ ...tv, stats: stats.get(tv.id)! }));
}

/**
 * Paginated + filtered travelers list with the same derived stats as
 * `listTravelersWithStats`, computed only for the current page's travelers.
 */
export async function listTravelersWithStatsPaged(
  opts: { search?: string; skip?: number; take?: number },
  now: Date = new Date(),
) {
  const where = {
    archivedAt: null,
    ...(opts.search ? { OR: [{ name: { contains: opts.search } }, { contact: { contains: opts.search } }] } : {}),
  };
  const [travelers, total] = await prisma.$transaction([
    prisma.traveler.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { photos: true } } },
      skip: opts.skip ?? 0,
      take: opts.take ?? 50,
    }),
    prisma.traveler.count({ where }),
  ]);
  const ids = travelers.map((t) => t.id);
  const stats = new Map<number, TravelerStats>();
  for (const id of ids) stats.set(id, { tripCount: 0, itemCount: 0, nextTrip: null, tripIds: [] });
  if (ids.length) {
    const trips = await prisma.trip.findMany({
      where: { travelerId: { in: ids }, archivedAt: null },
      select: { id: true, travelerId: true, lastReceivingDate: true, status: true },
    });
    const tripIds = trips.map((t) => t.id);
    const items = tripIds.length
      ? await prisma.item.findMany({
          where: { containerType: "TRIP", containerId: { in: tripIds } },
          select: { containerId: true },
        })
      : [];
    const itemByTrip = new Map<number, number>();
    for (const it of items) if (it.containerId != null) itemByTrip.set(it.containerId, (itemByTrip.get(it.containerId) ?? 0) + 1);
    for (const tr of trips) {
      const s = stats.get(tr.travelerId);
      if (!s) continue;
      s.tripCount++;
      s.tripIds.push(tr.id);
      s.itemCount += itemByTrip.get(tr.id) ?? 0;
      if (tr.lastReceivingDate && tr.status !== "CANCELLED") {
        const ts = tr.lastReceivingDate.getTime();
        if (ts >= now.getTime() && (!s.nextTrip || ts < s.nextTrip.getTime())) s.nextTrip = tr.lastReceivingDate;
      }
    }
  }
  const rows = travelers.map((tv) => ({ ...tv, stats: stats.get(tv.id)! }));
  return { rows, total };
}
export function getTraveler(id: number) {
  return prisma.traveler.findFirst({
    where: { id, archivedAt: null },
    include: { photos: true, reference: { select: { id: true, name: true } } },
  });
}
/** Other travelers, for the "reference" picker (excludes the given id). */
export function listTravelersForPicker(exceptId?: number) {
  return prisma.traveler.findMany({
    where: { archivedAt: null, ...(exceptId ? { id: { not: exceptId } } : {}) },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

function dataFrom(input: TravelerInput) {
  return {
    name: input.name.trim(),
    contact: clean(input.contact),
    notes: clean(input.notes),
    referenceTravelerId: input.referenceTravelerId ?? null,
    blacklisted: input.blacklisted,
    staticAddress: input.staticAddress,
    carriesMaleSupport: input.carriesMaleSupport,
    allowedProductTypes: joinTypes(input.allowedProductTypes),
  };
}

export async function createTraveler(input: TravelerInput, photoAssetIds: string[], userId: number) {
  const uid = await nextUid("TRV");
  return prisma.traveler.create({
    data: {
      uid,
      ...dataFrom(input),
      createdById: userId,
      photos: photoAssetIds.length ? { create: photoAssetIds.map((assetId) => ({ assetId })) } : undefined,
    },
  });
}
export async function updateTraveler(
  id: number,
  input: TravelerInput & { active: boolean },
  addPhotoAssetIds: string[],
  userId: number,
) {
  return prisma.traveler.update({
    where: { id },
    data: {
      ...dataFrom(input),
      active: input.active,
      updatedById: userId,
      ...(addPhotoAssetIds.length ? { photos: { create: addPhotoAssetIds.map((assetId) => ({ assetId })) } } : {}),
    },
  });
}
export async function archiveTraveler(id: number) {
  return prisma.traveler.update({ where: { id }, data: { archivedAt: new Date(), active: false } });
}
