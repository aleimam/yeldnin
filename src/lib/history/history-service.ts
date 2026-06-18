import "server-only";
import { prisma } from "@/lib/db";
import { getLocale } from "@/i18n/server";
import { displayName } from "@/lib/users/users-logic";

/** Latest item movements across the system, enriched with item + actor names. */
export async function listRecentEvents(take = 100) {
  const events = await prisma.itemEvent.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: { item: { select: { uid: true, product: { select: { name: true } } } } },
  });
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
