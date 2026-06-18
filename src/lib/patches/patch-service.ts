import "server-only";
import { prisma } from "@/lib/db";
import { clean } from "@/lib/text";
import { nextUid } from "@/lib/uid";
import { moveItems, itemsInContainerHistory } from "@/lib/items/items-service";
import { MOVABLE_ITEMS_WHERE } from "@/lib/items/items-logic";

/** Purchases that still have ORDERED items waiting to be dispatched. */
export async function listPurchasesWithOrdered(scopes: string[]) {
  if (!scopes.length) return [];
  const items = await prisma.item.findMany({
    where: { status: "ORDERED", containerType: "PURCHASE", exceptionFlag: null, scope: { in: scopes } },
    select: { containerId: true },
  });
  const counts = new Map<number, number>();
  for (const it of items) if (it.containerId) counts.set(it.containerId, (counts.get(it.containerId) ?? 0) + 1);
  if (!counts.size) return [];
  const purchases = await prisma.purchase.findMany({
    where: { id: { in: [...counts.keys()] }, archivedAt: null },
    orderBy: { createdAt: "desc" },
  });
  return purchases.map((p) => ({ ...p, orderedCount: counts.get(p.id) ?? 0 }));
}

export function getPurchaseOrderedItems(purchaseId: number) {
  return prisma.item.findMany({
    where: { status: "ORDERED", containerType: "PURCHASE", containerId: purchaseId, exceptionFlag: null },
    orderBy: { id: "asc" },
    include: { product: { select: { name: true } } },
  });
}

export interface CreatePatchInput {
  purchaseId: number;
  itemIds: number[];
  tracking?: string | null;
  courierId?: number | null;
  notes?: string | null;
  handlingFee?: number | null;
  handlingFeeCurrency?: string | null;
}

/** Create a patch from a purchase and move the chosen items ORDERED → SHIPPED. */
export async function createPatch(input: CreatePatchInput, photoAssetIds: string[], userId: number) {
  const purchase = await prisma.purchase.findUnique({ where: { id: input.purchaseId } });
  if (!purchase) throw new Error("Purchase not found.");
  // Only items that really belong to this purchase and are still ORDERED.
  const items = await prisma.item.findMany({
    where: { id: { in: input.itemIds }, status: "ORDERED", containerType: "PURCHASE", containerId: purchase.id, exceptionFlag: null },
    select: { id: true },
  });
  if (!items.length) throw new Error("No dispatchable items selected.");

  let courierName: string | null = null;
  if (input.courierId) {
    const c = await prisma.courier.findUnique({ where: { id: input.courierId }, select: { name: true } });
    courierName = c?.name ?? null;
  }

  const uid = await nextUid("PAT");
  const patch = await prisma.patch.create({
    data: {
      uid,
      purchaseId: purchase.id,
      scope: purchase.scope,
      country: purchase.country,
      supplierName: purchase.supplierName,
      destinationType: purchase.destinationType,
      destinationId: purchase.destinationId,
      destinationName: purchase.destinationName,
      tracking: clean(input.tracking),
      courierId: input.courierId ?? null,
      courier: courierName,
      notes: clean(input.notes),
      handlingFee: input.handlingFee ?? null,
      handlingFeeCurrency: input.handlingFeeCurrency ?? null,
      createdById: userId,
      photos: photoAssetIds.length ? { create: photoAssetIds.map((assetId) => ({ assetId })) } : undefined,
    },
  });
  await moveItems(
    items.map((i) => i.id),
    { status: "SHIPPED", containerType: "PATCH", containerId: patch.id, action: "dispatch" },
    userId,
  );
  // Dispatching from a purchase marks that purchase as Dispatched.
  await prisma.purchase.update({ where: { id: purchase.id }, data: { status: "DISPATCHED" } });
  return patch;
}

function patchItemIds(patchId: number) {
  return prisma.item.findMany({
    where: { containerType: "PATCH", containerId: patchId, ...MOVABLE_ITEMS_WHERE },
    select: { id: true },
  });
}

/** Mark a patch Delivered → its items DELIVERED. */
export async function markPatchDelivered(patchId: number, userId: number) {
  const patch = await prisma.patch.findUnique({ where: { id: patchId } });
  if (!patch || patch.status !== "DISPATCHED") return;
  await prisma.patch.update({ where: { id: patchId }, data: { status: "DELIVERED", deliveredAt: new Date(), updatedById: userId } });
  const items = await patchItemIds(patchId);
  await moveItems(items.map((i) => i.id), { status: "DELIVERED", action: "delivered" }, userId);
}

/** Mark a patch Received → items HUB (Received) at the destination hub (timers start). */
export async function markPatchReceived(patchId: number, userId: number) {
  const patch = await prisma.patch.findUnique({ where: { id: patchId } });
  if (!patch || patch.status === "RECEIVED") return;
  await prisma.patch.update({ where: { id: patchId }, data: { status: "RECEIVED", receivedAt: new Date(), updatedById: userId } });
  const items = await patchItemIds(patchId);
  await moveItems(
    items.map((i) => i.id),
    { status: "HUB", containerType: patch.destinationType, containerId: patch.destinationId, action: "received" },
    userId,
  );
}

export function listPatches(opts: { scopes: string[] }) {
  return prisma.patch.findMany({ where: { archivedAt: null, scope: { in: opts.scopes } }, orderBy: { createdAt: "desc" }, take: 200 });
}
export function getPatch(id: number) {
  return prisma.patch.findFirst({ where: { id, archivedAt: null }, include: { photos: true } });
}
export function getPatchItems(patchId: number) {
  return itemsInContainerHistory("PATCH", patchId);
}
