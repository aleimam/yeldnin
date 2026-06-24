import "server-only";
import { prisma } from "@/lib/db";
import { nextUid } from "@/lib/uid";
import { moveItems, itemsInContainerHistory } from "@/lib/items/items-service";
import { PRE_RECEIPT_STATUSES } from "@/lib/items/items-logic";
import { getWorkflow } from "@/lib/workflow/workflow-config-service";
import { autoAdvanceSchedule } from "@/lib/workflow/workflow-logic";
import { nextTransferStatus } from "./transfer-logic";
import { formatBizDate } from "@/lib/format/dates";

interface EndpointInfo {
  name: string;
  country: string | null; // null for a traveler holding (country comes from the items)
}

async function resolveEndpoint(type: string, id: number): Promise<EndpointInfo | null> {
  if (type === "HUB") {
    const h = await prisma.hub.findUnique({ where: { id }, select: { name: true, country: true } });
    return h ? { name: h.name, country: h.country } : null;
  }
  if (type === "TRIP") {
    const t = await prisma.trip.findUnique({ where: { id }, select: { country: true, lastReceivingDate: true, traveler: { select: { name: true } } } });
    return t ? { name: `${t.traveler?.name ?? "—"}${t.lastReceivingDate ? ` · ${formatBizDate(t.lastReceivingDate)}` : ""}`, country: t.country } : null;
  }
  if (type === "TRAVELER") {
    const tr = await prisma.traveler.findUnique({ where: { id }, select: { name: true } });
    return tr ? { name: tr.name, country: null } : null;
  }
  return null;
}

/** Received, un-flagged items currently held at a source endpoint (eligible to transfer). */
export function eligibleItemsAt(type: string, id: number) {
  return prisma.item.findMany({
    where: { containerType: type, containerId: id, exceptionFlag: null, status: { notIn: PRE_RECEIPT_STATUSES } },
    orderBy: { id: "asc" },
    include: { product: { select: { id: true, name: true } } },
  });
}

export interface CreateTransferInput {
  fromType: string;
  fromId: number;
  toType: string;
  toId: number;
  itemIds: number[];
  courierId?: number | null;
  tracking?: string | null;
  notes?: string | null;
  photoAssetIds?: string[];
}

/** Create a transfer (validate endpoints + same country) and move eligible items into it. */
export async function createTransfer(input: CreateTransferInput, userId: number) {
  const [from, to] = await Promise.all([resolveEndpoint(input.fromType, input.fromId), resolveEndpoint(input.toType, input.toId)]);
  if (!from || !to) throw new Error("Invalid source or destination.");
  if (input.fromType === input.toType && input.fromId === input.toId) throw new Error("Source and destination must differ.");

  const eligible = await prisma.item.findMany({
    where: { id: { in: input.itemIds }, containerType: input.fromType, containerId: input.fromId, exceptionFlag: null, status: { notIn: PRE_RECEIPT_STATUSES } },
    select: { id: true, country: true },
  });
  if (!eligible.length) throw new Error("No eligible items to transfer.");

  // Move country: from the source endpoint (hub/trip) or, for a traveler holding, from the items themselves.
  let moveCountry = from.country;
  if (input.fromType === "TRAVELER") {
    const countries = new Set(eligible.map((i) => i.country ?? ""));
    if (countries.size > 1) throw new Error("Selected items are in different countries — transfer one country at a time.");
    moveCountry = eligible[0].country ?? null;
  }
  if (!moveCountry) throw new Error("Could not determine the transfer country.");
  // Same-country rule (skipped when the destination is a traveler holding — items just keep their country).
  if (input.toType !== "TRAVELER" && to.country && to.country !== moveCountry) {
    throw new Error("Transfers must stay within the same country.");
  }

  const courier = input.courierId ? await prisma.courier.findUnique({ where: { id: input.courierId }, select: { name: true } }) : null;
  const uid = await nextUid("TRF");
  const transfer = await prisma.transfer.create({
    data: {
      uid,
      country: moveCountry,
      fromType: input.fromType,
      fromId: input.fromId,
      fromName: from.name,
      toType: input.toType,
      toId: input.toId,
      toName: to.name,
      courierId: input.courierId ?? null,
      courier: courier?.name ?? null,
      tracking: input.tracking?.trim() || null,
      notes: input.notes?.trim() || null,
      createdById: userId,
      photos: input.photoAssetIds?.length ? { create: input.photoAssetIds.map((assetId) => ({ assetId })) } : undefined,
    },
  });
  await moveItems(eligible.map((i) => i.id), { containerType: "TRANSFER", containerId: transfer.id, action: "transfer-add" }, userId);
  return transfer;
}

/** Advance a transfer NEW → LEFT_ORIGIN → DELIVERED → RECEIVED. At RECEIVED the
 *  items re-receive at the destination (status HUB + country; timers reset for a
 *  hub/trip, held — no timers — for a traveler holding). */
export async function advanceTransfer(id: number, userId: number) {
  const transfer = await prisma.transfer.findUnique({ where: { id } });
  if (!transfer) return;
  const next = nextTransferStatus(transfer.status);
  if (!next) return;
  const now = new Date();
  const stamp =
    next === "LEFT_ORIGIN" ? { leftOriginAt: now } : next === "DELIVERED" ? { deliveredAt: now } : next === "RECEIVED" ? { receivedAt: now } : {};
  await prisma.transfer.update({ where: { id }, data: { status: next, updatedById: userId, ...stamp } });

  if (next === "RECEIVED") {
    const items = await prisma.item.findMany({ where: { containerType: "TRANSFER", containerId: id } });
    const wf = await getWorkflow();
    const heldDest = transfer.toType === "TRAVELER";
    for (const it of items) {
      const sched = heldDest ? null : autoAdvanceSchedule(now, Math.random, wf.timers);
      await prisma.item.update({
        where: { id: it.id },
        data: {
          containerType: transfer.toType,
          containerId: transfer.toId,
          status: "HUB",
          country: transfer.country,
          receivedAt: now,
          transitAt: sched?.transitAt ?? null,
          globalShippingAt: sched?.globalShippingAt ?? null,
        },
      });
      await prisma.itemEvent.create({
        data: { itemId: it.id, fromStatus: it.status, toStatus: "HUB", containerType: transfer.toType, containerId: transfer.toId, action: "transfer-received", byUserId: userId },
      });
    }
  }
}

// ── Traveler holding ───────────────────────────────────────────────────────────

/** Trip cancelled/completed → its un-flagged + DELAYED leftover items fall to the
 *  traveler's holding (DELAYED flag cleared; timers cleared so they sit idle; the
 *  trip's country is remembered for later transfers). */
export async function fallTripItemsToHolding(tripId: number, userId: number, opts: { onlyDelayed?: boolean } = {}) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { travelerId: true, country: true } });
  if (!trip?.travelerId) return;
  const items = await prisma.item.findMany({
    where: {
      containerType: "TRIP",
      containerId: tripId,
      // Cancel sweeps un-flagged + delayed; completion (pickup) sweeps only the
      // delayed leftovers (un-flagged were already picked up to OFFICE).
      ...(opts.onlyDelayed ? { exceptionFlag: "DELAYED" } : { OR: [{ exceptionFlag: null }, { exceptionFlag: "DELAYED" }] }),
    },
    select: { id: true, status: true },
  });
  for (const it of items) {
    await prisma.item.update({
      where: { id: it.id },
      data: {
        containerType: "TRAVELER",
        containerId: trip.travelerId,
        country: trip.country,
        exceptionFlag: null,
        sourceContainerType: null,
        sourceContainerId: null,
        exceptionNote: null,
        exceptionAt: null,
        exceptionById: null,
        transitAt: null,
        globalShippingAt: null,
      },
    });
    await prisma.itemEvent.create({
      data: { itemId: it.id, fromStatus: it.status, toStatus: it.status, containerType: "TRAVELER", containerId: trip.travelerId, action: "to-holding", byUserId: userId },
    });
  }
}

/** New trip for a traveler → auto-attach their held inventory to it. */
export async function attachHoldingToTrip(travelerId: number, tripId: number, userId: number) {
  const held = await prisma.item.findMany({ where: { containerType: "TRAVELER", containerId: travelerId, exceptionFlag: null }, select: { id: true } });
  if (!held.length) return;
  await moveItems(held.map((i) => i.id), { containerType: "TRIP", containerId: tripId, action: "holding-to-trip" }, userId);
}

/** Items currently in a traveler's holding (for the traveler page + transfer source). */
export function holdingItems(travelerId: number) {
  return prisma.item.findMany({
    where: { containerType: "TRAVELER", containerId: travelerId },
    orderBy: { id: "asc" },
    include: { product: { select: { id: true, name: true } } },
  });
}

// ── Listing & pickers ───────────────────────────────────────────────────────────

export function listTransfers() {
  return prisma.transfer.findMany({ where: { archivedAt: null }, orderBy: { createdAt: "desc" }, take: 200 });
}

/** Paginated + filtered transfers (for the Transfers page). */
export async function listTransfersPaged(opts: { search?: string; skip?: number; take?: number }) {
  const where = {
    archivedAt: null,
    ...(opts.search
      ? {
          OR: [
            { uid: { contains: opts.search } },
            { fromName: { contains: opts.search } },
            { toName: { contains: opts.search } },
            { country: { contains: opts.search } },
            { tracking: { contains: opts.search } },
            { courier: { contains: opts.search } },
          ],
        }
      : {}),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.transfer.findMany({ where, orderBy: { createdAt: "desc" }, skip: opts.skip ?? 0, take: opts.take ?? 50 }),
    prisma.transfer.count({ where }),
  ]);
  return { rows, total };
}
export function getTransfer(id: number) {
  return prisma.transfer.findFirst({ where: { id, archivedAt: null }, include: { photos: true } });
}
export function getTransferItems(id: number) {
  return itemsInContainerHistory("TRANSFER", id);
}

export interface EndpointOption {
  type: "HUB" | "TRIP" | "TRAVELER";
  id: number;
  label: string;
  country: string | null;
}

/** All transfer endpoints (active hubs, open trips, travelers) for the from/to pickers. */
export async function transferEndpoints(): Promise<EndpointOption[]> {
  const [hubs, trips, travelers] = await Promise.all([
    prisma.hub.findMany({ where: { archivedAt: null, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, country: true } }),
    prisma.trip.findMany({ where: { archivedAt: null, status: { in: ["APPROVED", "STARTED_SHIPPING", "COMPLETED_SHIPPING", "COMPLETED_RECEIVING", "WAITING_TRIP"] } }, orderBy: { lastReceivingDate: "asc" }, select: { id: true, country: true, lastReceivingDate: true, traveler: { select: { name: true } } } }),
    prisma.traveler.findMany({ where: { archivedAt: null, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return [
    ...hubs.map((h) => ({ type: "HUB" as const, id: h.id, label: `🏠 ${h.name} · ${h.country}`, country: h.country })),
    ...trips.map((t) => ({ type: "TRIP" as const, id: t.id, label: `✈️ ${t.traveler?.name ?? "—"}${t.lastReceivingDate ? ` · ${formatBizDate(t.lastReceivingDate)}` : ""} · ${t.country}`, country: t.country })),
    ...travelers.map((tr) => ({ type: "TRAVELER" as const, id: tr.id, label: `🧳 ${tr.name}`, country: null })),
  ];
}
