import "server-only";
import { prisma } from "@/lib/db";
import { clean } from "@/lib/text";
import { nextUid } from "@/lib/uid";
import { sendLocalizedToUsers, resolveRecipients } from "@/lib/notify/notify-service";
import { issueOpenedPayload } from "@/lib/notify/notify-logic";

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
  await sendLocalizedToUsers(await resolveRecipients("issue.opened"), (t) => issueOpenedPayload(t, issue)).catch(() => {});
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
  await sendLocalizedToUsers(await resolveRecipients("issue.opened"), (t) => issueOpenedPayload(t, issue)).catch(() => {});
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

/** Paginated issues list. Scope-filtered per the viewer's issueVisibility:
 *  "all" imposes no scope where; an array restricts to those scopes (excluding
 *  unscoped back-office issues). Plus optional status filter + free-text search. */
export async function listIssuesPaged(opts: { scopeFilter: "all" | string[]; status?: string; search?: string; skip?: number; take?: number }) {
  const where = {
    ...(opts.scopeFilter === "all" ? {} : { scope: { in: opts.scopeFilter } }),
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.search
      ? {
          OR: [
            { uid: { contains: opts.search } },
            { title: { contains: opts.search } },
            { note: { contains: opts.search } },
          ],
        }
      : {}),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.issue.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { compensations: true } } },
      skip: opts.skip ?? 0,
      take: opts.take ?? 50,
    }),
    prisma.issue.count({ where }),
  ]);
  return { rows, total };
}
export function getIssue(id: number) {
  return prisma.issue.findUnique({
    where: { id },
    include: { photos: true, items: true, compensations: { orderBy: { createdAt: "desc" } } },
  });
}

/** Just an issue's scope — feeds the visibility check on the mutation actions. */
export function getIssueScope(id: number) {
  return prisma.issue.findUnique({ where: { id }, select: { scope: true } });
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
