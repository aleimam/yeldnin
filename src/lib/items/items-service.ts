import "server-only";
import { prisma } from "@/lib/db";
import { nextUid } from "@/lib/uid";
import { autoAdvanceSchedule } from "@/lib/workflow/workflow-logic";
import { getWorkflow } from "@/lib/workflow/workflow-config-service";
import { dueAutoAdvance } from "./items-logic";
import { notifyModuleOperators } from "@/lib/notify/notify-service";
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
  }
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
  if (items.length) await notifyModuleOperators(["purchasing", "logistics", "operations"], itemsFlaggedPayload(items.length, flag)).catch(() => {});
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
    include: { product: { select: { name: true } } },
  });
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
