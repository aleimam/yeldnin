import "server-only";
import { prisma } from "@/lib/db";
import { clean } from "@/lib/text";
import { nextUid } from "@/lib/uid";

export interface HubInput {
  name: string;
  country: string;
  notes?: string | null;
}

export function listHubs() {
  return prisma.hub.findMany({
    where: { archivedAt: null },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { photos: true } } },
    take: 200,
  });
}
/** Paginated + searchable hubs (name / uid / country). */
export async function listHubsPaged(opts: { search?: string; skip?: number; take?: number }) {
  const where = { archivedAt: null, ...(opts.search ? { OR: [{ name: { contains: opts.search } }, { uid: { contains: opts.search } }, { country: { contains: opts.search } }] } : {}) };
  const [rows, total] = await prisma.$transaction([
    prisma.hub.findMany({ where, orderBy: { createdAt: "desc" }, include: { _count: { select: { photos: true } } }, skip: opts.skip ?? 0, take: opts.take ?? 50 }),
    prisma.hub.count({ where }),
  ]);
  return { rows, total };
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
