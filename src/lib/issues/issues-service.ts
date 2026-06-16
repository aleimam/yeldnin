import "server-only";
import { prisma } from "@/lib/db";
import { nextUid } from "@/lib/uid";
import { notifyAdmins } from "@/lib/notify/notify-service";
import { issueOpenedPayload } from "@/lib/notify/notify-logic";

const clean = (s?: string | null) => s?.trim() || null;

export async function createIssue(
  input: { title: string; note?: string | null; scope?: string | null },
  photoAssetIds: string[],
  itemRefs: { itemId: number; label: string }[],
  userId: number,
) {
  const uid = await nextUid("ISS");
  const issue = await prisma.issue.create({
    data: {
      uid,
      title: input.title.trim(),
      note: clean(input.note),
      scope: clean(input.scope),
      sourceType: "MANUAL",
      createdById: userId,
      photos: photoAssetIds.length ? { create: photoAssetIds.map((assetId) => ({ assetId })) } : undefined,
      items: itemRefs.length ? { create: itemRefs.map((r) => ({ itemId: r.itemId, label: r.label })) } : undefined,
    },
  });
  await notifyAdmins(issueOpenedPayload(issue)).catch(() => {});
  return issue;
}

/** Open (or update) the issue auto-created from a trip-review ISSUE mark. */
export async function openIssueForMark(
  markId: number,
  input: { title: string; note?: string | null },
  userId: number,
) {
  const existing = await prisma.issue.findFirst({ where: { sourceType: "TRIP_MARK", sourceId: markId } });
  if (existing) {
    await prisma.issue.update({ where: { id: existing.id }, data: { title: input.title, note: clean(input.note), updatedById: userId } });
    return existing.id;
  }
  const uid = await nextUid("ISS");
  const issue = await prisma.issue.create({
    data: { uid, title: input.title, note: clean(input.note), sourceType: "TRIP_MARK", sourceId: markId, createdById: userId },
  });
  await notifyAdmins(issueOpenedPayload(issue)).catch(() => {});
  return issue.id;
}

export function listIssues(opts: { status?: string } = {}) {
  return prisma.issue.findMany({
    where: { ...(opts.status ? { status: opts.status } : {}) },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { compensations: true } } },
    take: 200,
  });
}
export function getIssue(id: number) {
  return prisma.issue.findUnique({
    where: { id },
    include: { photos: true, items: true, compensations: { orderBy: { createdAt: "desc" } } },
  });
}
export async function resolveIssue(id: number, userId: number) {
  return prisma.issue.update({ where: { id }, data: { status: "SOLVED", resolvedAt: new Date(), updatedById: userId } });
}
export async function reopenIssue(id: number, userId: number) {
  return prisma.issue.update({ where: { id }, data: { status: "OPEN", resolvedAt: null, updatedById: userId } });
}
export async function addCompensation(
  issueId: number,
  input: { type: string; amountEgp?: number | null; note?: string | null },
  userId: number,
) {
  return prisma.compensation.create({
    data: {
      issueId,
      type: input.type,
      amountEgp: input.type === "MONEY" ? (input.amountEgp ?? null) : null,
      note: clean(input.note),
      createdById: userId,
    },
  });
}
