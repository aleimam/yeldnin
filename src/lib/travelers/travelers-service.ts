import "server-only";
import { prisma } from "@/lib/db";
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
const clean = (s?: string | null) => s?.trim() || null;

export function listTravelers() {
  return prisma.traveler.findMany({
    where: { archivedAt: null },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { photos: true } } },
    take: 200,
  });
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
