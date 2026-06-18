import "server-only";
import { prisma } from "@/lib/db";
import { nextUid } from "@/lib/uid";
import { autoAdvanceSchedule } from "@/lib/workflow/workflow-logic";
import { getWorkflow } from "@/lib/workflow/workflow-config-service";
import {
  dueAutoAdvance,
  itemBucket,
  ITEM_BUCKETS,
  tallyCategories,
  emptyCategoryCounts,
  PRE_RECEIPT_STATUSES,
  MOVABLE_ITEMS_WHERE,
  type CategoryCounts,
} from "./items-logic";
import { sendLocalizedToUsers, resolveRecipients, notifyUnitMilestones } from "@/lib/notify/notify-service";
import { itemsFlaggedPayload } from "@/lib/notify/notify-logic";

export interface CreateItemsInput {
  productId: number;
  scope: string;
  count: number;
  requestId?: number | null;
  isSpecialOrder?: boolean;
  sellingPrice?: number | null;
  purchasePrice?: number | null;
  purchaseCurrency?: string | null;
  containerType?: string | null;
  containerId?: number | null;
  status?: string;
  promisedDeliveryAt?: Date | null;
  isGift?: boolean;
  userId: number;
}

/** Create N tracked items (one row per unit), each with an initial event. */
export async function createItems(input: CreateItemsInput): Promise<number[]> {
  const status = input.status ?? "REQUESTED";
  const containerType = input.containerType ?? "REQUEST";
  const ids: number[] = [];
  for (let i = 0; i < input.count; i++) {
    const uid = await nextUid("ITM");
    const item = await prisma.item.create({
      data: {
        uid,
        productId: input.productId,
        scope: input.scope,
        status,
        containerType,
        containerId: input.containerId ?? null,
        requestId: input.requestId ?? null,
        isSpecialOrder: input.isSpecialOrder ?? false,
        isGift: input.isGift ?? false,
        promisedDeliveryAt: input.promisedDeliveryAt ?? null,
        sellingPrice: input.sellingPrice ?? null,
        purchasePrice: input.purchasePrice ?? null,
        purchaseCurrency: input.purchaseCurrency ?? null,
        createdById: input.userId,
        events: { create: { toStatus: status, containerType, containerId: input.containerId ?? null, action: "created", byUserId: input.userId } },
      },
    });
    ids.push(item.id);
  }
  return ids;
}

interface ItemUpdate {
  containerType?: string | null;
  containerId?: number | null;
  status?: string;
  receivedAt?: Date;
  transitAt?: Date;
  globalShippingAt?: Date;
}

/**
 * Move items to a new container and/or status, writing an ItemEvent each.
 * Becoming Received (HUB) stamps receivedAt and schedules the auto-advance
 * timers using the admin-configured ranges.
 */
export async function moveItems(
  itemIds: number[],
  to: { containerType?: string | null; containerId?: number | null; status?: string; action?: string },
  userId: number,
): Promise<void> {
  if (!itemIds.length) return;
  const items = await prisma.item.findMany({ where: { id: { in: itemIds } } });
  const wf = await getWorkflow();
  const milestones: { requestId: number; toStatus: string }[] = [];
  for (const it of items) {
    const toStatus = to.status ?? it.status;
    const data: ItemUpdate = {
      containerType: to.containerType ?? it.containerType,
      containerId: to.containerId !== undefined ? to.containerId : it.containerId,
      status: toStatus,
    };
    if (toStatus === "HUB" && it.status !== "HUB") {
      const receivedAt = new Date();
      const sched = autoAdvanceSchedule(receivedAt, Math.random, wf.timers);
      data.receivedAt = receivedAt;
      data.transitAt = sched.transitAt;
      data.globalShippingAt = sched.globalShippingAt;
    }
    await prisma.item.update({ where: { id: it.id }, data });
    await prisma.itemEvent.create({
      data: {
        itemId: it.id,
        fromStatus: it.status,
        toStatus,
        containerType: data.containerType ?? null,
        containerId: data.containerId ?? null,
        action: to.action ?? "move",
        byUserId: userId,
      },
    });
    if (toStatus !== it.status && it.requestId) {
      milestones.push({ requestId: it.requestId, toStatus });
    }
  }
  if (milestones.length) await notifyUnitMilestones(milestones, userId).catch(() => {});
}

/** Flag items as an exception (Lost/Damaged/Errant/Delayed), remembering their source. */
export async function flagItems(itemIds: number[], flag: string, userId: number): Promise<void> {
  const items = await prisma.item.findMany({ where: { id: { in: itemIds } } });
  for (const it of items) {
    await prisma.item.update({
      where: { id: it.id },
      data: { exceptionFlag: flag, sourceContainerType: it.containerType, sourceContainerId: it.containerId },
    });
    await prisma.itemEvent.create({
      data: { itemId: it.id, fromStatus: it.status, toStatus: it.status, action: `flag:${flag}`, byUserId: userId },
    });
  }
  if (items.length) await sendLocalizedToUsers(await resolveRecipients("items.flagged"), (t) => itemsFlaggedPayload(t, items.length, flag)).catch(() => {});
}

/** Item-status rollup for the Requests dashboard (counts per bucket, scope-filtered). */
export async function itemStatusSummary(scopes: string[]): Promise<Record<string, number>> {
  const counts: Record<string, number> = Object.fromEntries(ITEM_BUCKETS.map((b) => [b, 0]));
  if (!scopes.length) return counts;
  const items = await prisma.item.findMany({ where: { scope: { in: scopes } }, select: { status: true, exceptionFlag: true } });
  for (const it of items) counts[itemBucket(it.status, it.exceptionFlag)]++;
  return counts;
}

/** Clear an exception flag (e.g. delayed item rejoining the flow). */
export async function clearFlag(itemIds: number[], userId: number): Promise<void> {
  for (const id of itemIds) {
    const it = await prisma.item.findUnique({ where: { id } });
    if (!it) continue;
    await prisma.item.update({ where: { id }, data: { exceptionFlag: null } });
    await prisma.itemEvent.create({ data: { itemId: id, fromStatus: it.status, toStatus: it.status, action: "flag:clear", byUserId: userId } });
  }
}

/**
 * Items that ever entered a given container (via the event log), regardless of
 * where they are now. Container detail pages use this — items move *out* when
 * they advance, so a "current occupants" query would lose them.
 */
export async function itemsInContainerHistory(containerType: string, containerId: number) {
  const events = await prisma.itemEvent.findMany({
    where: { containerType, containerId },
    select: { itemId: true },
  });
  const ids = [...new Set(events.map((e) => e.itemId))];
  if (!ids.length) return [];
  return prisma.item.findMany({
    where: { id: { in: ids } },
    orderBy: { id: "asc" },
    include: { product: { select: { id: true, name: true } } },
  });
}

/** Category buckets for items CURRENTLY in each container (e.g. trip/hub inventory). */
export async function categoryCountsByCurrentContainer(
  containerType: string,
  ids: number[],
): Promise<Map<number, CategoryCounts>> {
  const out = new Map<number, CategoryCounts>();
  if (!ids.length) return out;
  const items = await prisma.item.findMany({
    where: { containerType, containerId: { in: ids } },
    select: { containerId: true, scope: true, product: { select: { type: true } } },
  });
  const byContainer = new Map<number, { scope: string; productType: string | null }[]>();
  for (const it of items) {
    if (it.containerId == null) continue;
    const arr = byContainer.get(it.containerId) ?? [];
    arr.push({ scope: it.scope, productType: it.product?.type ?? null });
    byContainer.set(it.containerId, arr);
  }
  for (const id of ids) out.set(id, tallyCategories(byContainer.get(id) ?? []));
  return out;
}

/** Category buckets for items that EVER entered each container — i.e. every unit
 *  of a purchase/patch, regardless of where it sits now (via the event log). */
export async function categoryCountsByContainerHistory(
  containerType: string,
  ids: number[],
): Promise<Map<number, CategoryCounts>> {
  const out = new Map<number, CategoryCounts>();
  if (!ids.length) return out;
  for (const id of ids) out.set(id, emptyCategoryCounts());
  const events = await prisma.itemEvent.findMany({
    where: { containerType, containerId: { in: ids } },
    select: { containerId: true, itemId: true },
  });
  const itemsByContainer = new Map<number, Set<number>>();
  const allItemIds = new Set<number>();
  for (const e of events) {
    if (e.containerId == null) continue;
    let s = itemsByContainer.get(e.containerId);
    if (!s) {
      s = new Set();
      itemsByContainer.set(e.containerId, s);
    }
    s.add(e.itemId);
    allItemIds.add(e.itemId);
  }
  if (!allItemIds.size) return out;
  const items = await prisma.item.findMany({
    where: { id: { in: [...allItemIds] } },
    select: { id: true, scope: true, product: { select: { type: true } } },
  });
  const meta = new Map(items.map((it) => [it.id, { scope: it.scope, productType: it.product?.type ?? null }]));
  for (const id of ids) {
    const set = itemsByContainer.get(id);
    if (!set) continue;
    const rows = [...set].flatMap((iid) => {
      const m = meta.get(iid);
      return m ? [m] : [];
    });
    out.set(id, tallyCategories(rows));
  }
  return out;
}

/** Category buckets for the items of each request (Item.requestId). */
export async function categoryCountsByRequest(ids: number[]): Promise<Map<number, CategoryCounts>> {
  const out = new Map<number, CategoryCounts>();
  if (!ids.length) return out;
  const items = await prisma.item.findMany({
    where: { requestId: { in: ids } },
    select: { requestId: true, scope: true, product: { select: { type: true } } },
  });
  const byReq = new Map<number, { scope: string; productType: string | null }[]>();
  for (const it of items) {
    if (it.requestId == null) continue;
    const arr = byReq.get(it.requestId) ?? [];
    arr.push({ scope: it.scope, productType: it.product?.type ?? null });
    byReq.set(it.requestId, arr);
  }
  for (const id of ids) out.set(id, tallyCategories(byReq.get(id) ?? []));
  return out;
}

/** Items (with product + weight + status) currently sitting in a container. */
export function currentContainerItems(containerType: string, containerId: number) {
  return prisma.item.findMany({
    where: { containerType, containerId },
    orderBy: { id: "asc" },
    include: { product: { select: { id: true, name: true, weightG: true } } },
  });
}

/** Items heading to a destination (TRIP/HUB) via a purchase or patch that haven't
 *  been received yet (pre-HUB), excluding LOST/DAMAGED/ERRANT — the detailed list
 *  behind {@link inboundPendingByDestination}. */
export async function inboundPendingItems(destType: "TRIP" | "HUB", destId: number) {
  const [purchases, patches] = await Promise.all([
    prisma.purchase.findMany({ where: { destinationType: destType, destinationId: destId, archivedAt: null }, select: { id: true } }),
    prisma.patch.findMany({ where: { destinationType: destType, destinationId: destId, archivedAt: null }, select: { id: true } }),
  ]);
  const purchaseIds = purchases.map((p) => p.id);
  const patchIds = patches.map((p) => p.id);
  if (!purchaseIds.length && !patchIds.length) return [];
  return prisma.item.findMany({
    where: {
      status: { in: PRE_RECEIPT_STATUSES },
      AND: [
        MOVABLE_ITEMS_WHERE,
        {
          OR: [
            { containerType: "PURCHASE", containerId: { in: purchaseIds } },
            { containerType: "PATCH", containerId: { in: patchIds } },
          ],
        },
      ],
    },
    orderBy: { id: "asc" },
    include: { product: { select: { id: true, name: true, weightG: true } } },
  });
}

export interface InboundPending {
  count: number;
  weightG: number;
}

/**
 * Items heading to a destination (TRIP/HUB) via a purchase or patch that haven't
 * been received yet (status before HUB). LOST/DAMAGED/ERRANT are excluded — they
 * won't arrive. Returns count + total weight (grams) per destination id.
 */
export async function inboundPendingByDestination(
  destType: "TRIP" | "HUB",
  ids: number[],
): Promise<Map<number, InboundPending>> {
  const out = new Map<number, InboundPending>();
  if (!ids.length) return out;
  for (const id of ids) out.set(id, { count: 0, weightG: 0 });
  const [purchases, patches] = await Promise.all([
    prisma.purchase.findMany({
      where: { destinationType: destType, destinationId: { in: ids }, archivedAt: null },
      select: { id: true, destinationId: true },
    }),
    prisma.patch.findMany({
      where: { destinationType: destType, destinationId: { in: ids }, archivedAt: null },
      select: { id: true, destinationId: true },
    }),
  ]);
  const purchaseToDest = new Map(purchases.map((p) => [p.id, p.destinationId!]));
  const patchToDest = new Map(patches.map((p) => [p.id, p.destinationId!]));
  if (!purchaseToDest.size && !patchToDest.size) return out;
  const items = await prisma.item.findMany({
    where: {
      status: { in: PRE_RECEIPT_STATUSES },
      AND: [
        MOVABLE_ITEMS_WHERE,
        {
          OR: [
            { containerType: "PURCHASE", containerId: { in: [...purchaseToDest.keys()] } },
            { containerType: "PATCH", containerId: { in: [...patchToDest.keys()] } },
          ],
        },
      ],
    },
    select: { containerType: true, containerId: true, product: { select: { weightG: true } } },
  });
  for (const it of items) {
    if (it.containerId == null) continue;
    const destId = it.containerType === "PURCHASE" ? purchaseToDest.get(it.containerId) : patchToDest.get(it.containerId);
    if (destId == null) continue;
    const cur = out.get(destId);
    if (!cur) continue;
    cur.count++;
    cur.weightG += it.product?.weightG ?? 0;
  }
  return out;
}

/**
 * Timer-worker core: advance every item whose auto-advance timer is due
 * (HUB→TRANSIT, TRANSIT→GLOBAL_SHIPPING). Returns the number advanced.
 * Called by the scheduled job.
 */
export async function advanceDueItems(now: Date = new Date()): Promise<number> {
  const candidates = await prisma.item.findMany({
    where: {
      exceptionFlag: null,
      OR: [
        { status: "HUB", transitAt: { lte: now } },
        { status: "TRANSIT", globalShippingAt: { lte: now } },
      ],
    },
  });
  let advanced = 0;
  for (const it of candidates) {
    const to = dueAutoAdvance({ status: it.status, transitAt: it.transitAt, globalShippingAt: it.globalShippingAt }, now);
    if (!to) continue;
    await prisma.item.update({ where: { id: it.id }, data: { status: to } });
    await prisma.itemEvent.create({ data: { itemId: it.id, fromStatus: it.status, toStatus: to, action: "auto", byUserId: null } });
    advanced++;
  }
  return advanced;
}
