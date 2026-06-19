import "server-only";
import { prisma } from "@/lib/db";
import { nextUid } from "@/lib/uid";
import { moveItems, itemsInContainerHistory } from "@/lib/items/items-service";
import { fallTripItemsToHolding } from "@/lib/transfers/transfer-service";
import { splitTripIntoShipments } from "./operations-logic";

/** Operations picks up a Ready-to-pickup trip → trip PICKED_UP, items → OFFICE.
 *  Delayed leftovers that never travelled fall back to the traveler's holding. */
export async function pickUpTrip(tripId: number, userId: number) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip || trip.status !== "READY_TO_PICKUP") return;
  await prisma.trip.update({ where: { id: tripId }, data: { status: "PICKED_UP", updatedById: userId } });
  const items = await prisma.item.findMany({
    where: { containerType: "TRIP", containerId: tripId, exceptionFlag: null },
    select: { id: true },
  });
  await moveItems(items.map((i) => i.id), { status: "OFFICE", action: "pickup" }, userId);
  await fallTripItemsToHolding(tripId, userId, { onlyDelayed: true });
}

/** Split a picked-up trip into Shipments (by scope/size); move items into them. */
export async function convertTripToShipments(tripId: number, userId: number): Promise<number> {
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip || trip.status !== "PICKED_UP") return 0;
  // Idempotent: never split a trip twice.
  if ((await prisma.shipment.count({ where: { tripId } })) > 0) return 0;
  const items = await prisma.item.findMany({
    where: { containerType: "TRIP", containerId: tripId, exceptionFlag: null },
    include: { product: { select: { type: true } } },
  });
  if (!items.length) return 0;
  const groups = splitTripIntoShipments(items.map((it) => ({ id: it.id, scope: it.scope, productId: it.productId, type: it.product.type })));
  for (const g of groups) {
    const uid = await nextUid("SHP");
    const shipment = await prisma.shipment.create({ data: { uid, scope: g.scope, tripId, createdById: userId } });
    await moveItems(g.itemIds, { containerType: "SHIPMENT", containerId: shipment.id, action: "split" }, userId);
  }
  return groups.length;
}

/** Operations sent the shipment photos → shipment PHOTOS_SENT, items PHOTOS_SENT. */
export async function markShipmentPhotosSent(shipmentId: number, userId: number) {
  const sh = await prisma.shipment.findUnique({ where: { id: shipmentId } });
  if (!sh || sh.status !== "OFFICE") return;
  await prisma.shipment.update({ where: { id: shipmentId }, data: { status: "PHOTOS_SENT", updatedById: userId } });
  const items = await prisma.item.findMany({
    where: { containerType: "SHIPMENT", containerId: shipmentId, exceptionFlag: null },
    select: { id: true },
  });
  await moveItems(items.map((i) => i.id), { status: "PHOTOS_SENT", action: "photosSent" }, userId);
}

export function listShipments() {
  return prisma.shipment.findMany({ where: { archivedAt: null }, orderBy: { createdAt: "desc" }, take: 200 });
}
export function getShipment(id: number) {
  return prisma.shipment.findFirst({ where: { id, archivedAt: null } });
}
export function getShipmentItems(shipmentId: number) {
  return itemsInContainerHistory("SHIPMENT", shipmentId);
}
