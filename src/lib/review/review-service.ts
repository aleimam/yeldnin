import "server-only";
import { prisma } from "@/lib/db";
import { openIssueForMark } from "@/lib/issues/issues-service";

/** Upsert a team's mark for a trip (changeable until the trip is approved).
 *  An ISSUE mark opens (or updates) a linked Issue in the Issues module. */
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
  let markId: number;
  if (existing) {
    await prisma.tripMark.update({
      where: { id: existing.id },
      data: { status, note: note?.trim() || null, byUserId: userId, ...(photos ? { photos } : {}) },
    });
    markId = existing.id;
  } else {
    const created = await prisma.tripMark.create({
      data: { tripId, team, status, note: note?.trim() || null, byUserId: userId, photos },
    });
    markId = created.id;
  }
  if (status === "ISSUE") {
    await openIssueForMark(markId, { title: `Trip #${tripId} — ${team} issue`, note }, userId);
  }
}

export function getTripMarks(tripId: number) {
  return prisma.tripMark.findMany({ where: { tripId }, include: { photos: true } });
}
