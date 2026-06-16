import "server-only";
import { prisma } from "@/lib/db";

/** Upsert a team's mark for a trip (changeable until the trip is approved). */
export async function setTripMark(
  tripId: number,
  team: string,
  status: string,
  note: string | null,
  photoIds: string[],
  userId: number,
) {
  const existing = await prisma.tripMark.findUnique({ where: { tripId_team: { tripId, team } } });
  const photos = photoIds.length ? { create: photoIds.map((assetId) => ({ assetId })) } : undefined;
  if (existing) {
    await prisma.tripMark.update({
      where: { id: existing.id },
      data: { status, note: note?.trim() || null, byUserId: userId, ...(photos ? { photos } : {}) },
    });
  } else {
    await prisma.tripMark.create({
      data: { tripId, team, status, note: note?.trim() || null, byUserId: userId, photos },
    });
  }
}

export function getTripMarks(tripId: number) {
  return prisma.tripMark.findMany({ where: { tripId }, include: { photos: true } });
}
