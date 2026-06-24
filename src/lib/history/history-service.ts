import "server-only";
import { prisma } from "@/lib/db";
import { getLocale } from "@/i18n/server";
import { displayName } from "@/lib/users/users-logic";

type RawEvent = Awaited<ReturnType<typeof fetchEvents>>[number];
function fetchEvents(args: Parameters<typeof prisma.itemEvent.findMany>[0]) {
  return prisma.itemEvent.findMany({
    ...args,
    include: { item: { select: { uid: true, product: { select: { name: true } } } } },
  });
}

/** Enrich raw item events with the actor's display name (locale-aware). */
async function enrichEvents(events: RawEvent[]) {
  const ids = [...new Set(events.map((e) => e.byUserId).filter((x): x is number => typeof x === "number"))];
  const [locale, users] = await Promise.all([
    getLocale(),
    ids.length ? prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, nameAr: true } }) : Promise.resolve([]),
  ]);
  const nameOf = new Map(users.map((u) => [u.id, displayName(u, locale)]));
  return events.map((e) => ({
    id: e.id,
    createdAt: e.createdAt,
    itemId: e.itemId,
    itemUid: e.item.uid,
    productName: e.item.product.name,
    fromStatus: e.fromStatus,
    toStatus: e.toStatus,
    action: e.action,
    byName: e.byUserId ? nameOf.get(e.byUserId) ?? null : null,
  }));
}

/** Latest item movements across the system, enriched with item + actor names. */
export async function listRecentEvents(take = 100) {
  const events = await fetchEvents({ orderBy: { createdAt: "desc" }, take });
  return enrichEvents(events);
}

/** Paginated + searchable item movements (for the History page). Search matches
 *  the item UID or its product name. */
export async function listRecentEventsPaged(opts: { search?: string; skip?: number; take?: number }) {
  const where = opts.search
    ? { item: { OR: [{ uid: { contains: opts.search } }, { product: { name: { contains: opts.search } } }] } }
    : {};
  const [events, total] = await prisma.$transaction([
    fetchEvents({ where, orderBy: { createdAt: "desc" }, skip: opts.skip ?? 0, take: opts.take ?? 50 }),
    prisma.itemEvent.count({ where }),
  ]);
  return { rows: await enrichEvents(events), total };
}

/** One item with its full event timeline (ascending). */
export function getItemWithEvents(id: number) {
  return prisma.item.findUnique({
    where: { id },
    include: { product: { select: { name: true, uid: true } }, events: { orderBy: { createdAt: "asc" } } },
  });
}

export async function findItemIdByUid(uid: string): Promise<number | null> {
  const it = await prisma.item.findUnique({ where: { uid: uid.trim() }, select: { id: true } });
  return it?.id ?? null;
}
