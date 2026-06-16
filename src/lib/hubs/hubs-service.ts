import "server-only";
import { prisma } from "@/lib/db";
import { nextUid } from "@/lib/uid";

export interface HubInput {
  name: string;
  country: string;
  notes?: string | null;
}
const clean = (s?: string | null) => s?.trim() || null;

export function listHubs() {
  return prisma.hub.findMany({
    where: { archivedAt: null },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { photos: true } } },
    take: 200,
  });
}
export function getHub(id: number) {
  return prisma.hub.findFirst({ where: { id, archivedAt: null }, include: { photos: true } });
}
export async function createHub(input: HubInput, photoAssetIds: string[], userId: number) {
  const uid = await nextUid("HUB");
  return prisma.hub.create({
    data: {
      uid,
      name: input.name.trim(),
      country: input.country,
      notes: clean(input.notes),
      createdById: userId,
      photos: photoAssetIds.length ? { create: photoAssetIds.map((assetId) => ({ assetId })) } : undefined,
    },
  });
}
export async function updateHub(
  id: number,
  input: HubInput & { active: boolean },
  addPhotoAssetIds: string[],
  userId: number,
) {
  return prisma.hub.update({
    where: { id },
    data: {
      name: input.name.trim(),
      country: input.country,
      notes: clean(input.notes),
      active: input.active,
      updatedById: userId,
      ...(addPhotoAssetIds.length ? { photos: { create: addPhotoAssetIds.map((assetId) => ({ assetId })) } } : {}),
    },
  });
}
export async function archiveHub(id: number) {
  return prisma.hub.update({ where: { id }, data: { archivedAt: new Date(), active: false } });
}
