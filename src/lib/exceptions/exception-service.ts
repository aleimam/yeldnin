import "server-only";
import { prisma } from "@/lib/db";
import { nextUid } from "@/lib/uid";
import { moveItems } from "@/lib/items/items-service";
import { resolveIssue } from "@/lib/issues/issues-service";
import { poolOpensIssue } from "./exception-logic";
import { sendLocalizedToUsers, resolveRecipients } from "@/lib/notify/notify-service";
import { itemsFlaggedPayload, issueOpenedPayload } from "@/lib/notify/notify-logic";

const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
const itemLabel = (it: { uid: string | null; id: number; product: { name: string } | null }) =>
  `${it.product?.name ?? "—"} ${it.uid ?? `#${it.id}`}`;

/**
 * Flag items into an exception pool (LOST/DAMAGED/ERRANT/DELAYED), remembering
 * their source container. Loss pools (Lost/Damaged/Errant) auto-open one Issue
 * covering all the flagged items; Delayed does not. Notifies on every flag.
 */
export async function flagToPool(
  itemIds: number[],
  pool: string,
  opts: { note?: string | null; photoAssetIds?: string[] },
  userId: number,
): Promise<void> {
  const items = await prisma.item.findMany({
    where: { id: { in: itemIds } },
    include: { product: { select: { name: true } } },
  });
  if (!items.length) return;
  const note = opts.note?.trim() || null;
  const photoAssetIds = opts.photoAssetIds ?? [];
  const now = new Date();

  let issueId: number | null = null;
  if (poolOpensIssue(pool)) {
    const uid = await nextUid("ISS");
    const title = items.length === 1 ? `${titleCase(pool)}: ${items[0].product?.name ?? "item"}` : `${titleCase(pool)}: ${items.length} items`;
    const issue = await prisma.issue.create({
      data: {
        uid,
        title,
        note,
        scope: items[0].scope,
        sourceType: "EXCEPTION",
        createdById: userId,
        photos: photoAssetIds.length ? { create: photoAssetIds.map((assetId) => ({ assetId })) } : undefined,
        items: { create: items.map((it) => ({ itemId: it.id, label: itemLabel(it) })) },
      },
    });
    issueId = issue.id;
    await sendLocalizedToUsers(await resolveRecipients("issue.opened"), (t) => issueOpenedPayload(t, issue)).catch(() => {});
  }

  for (const it of items) {
    await prisma.item.update({
      where: { id: it.id },
      data: {
        exceptionFlag: pool,
        sourceContainerType: it.containerType,
        sourceContainerId: it.containerId,
        exceptionNote: note,
        exceptionAt: now,
        exceptionById: userId,
        exceptionIssueId: issueId,
      },
    });
    await prisma.itemEvent.create({
      data: { itemId: it.id, fromStatus: it.status, toStatus: it.status, action: `flag:${pool}`, byUserId: userId },
    });
  }
  await sendLocalizedToUsers(await resolveRecipients("items.flagged"), (t) => itemsFlaggedPayload(t, items.length, pool)).catch(() => {});
}

/** Close an exception Issue as solved ("found"/resolved) once none of its items
 *  remain flagged. No-op if some items are still in a pool. */
async function closeIssueIfClear(issueId: number, userId: number): Promise<void> {
  const stillFlagged = await prisma.item.count({ where: { exceptionIssueId: issueId, exceptionFlag: { not: null } } });
  if (stillFlagged === 0) await resolveIssue(issueId, userId).catch(() => {});
}

const EXCEPTION_NULLS = {
  exceptionFlag: null,
  sourceContainerType: null,
  sourceContainerId: null,
  exceptionNote: null,
  exceptionAt: null,
  exceptionById: null,
  exceptionIssueId: null,
} as const;

/** "Found" / clear: un-flag and return each item to its remembered source
 *  container; close the linked Issue when no flagged siblings remain. */
export async function clearException(itemIds: number[], userId: number): Promise<void> {
  const items = await prisma.item.findMany({ where: { id: { in: itemIds } } });
  const issueIds = new Set<number>();
  for (const it of items) {
    if (it.exceptionIssueId) issueIds.add(it.exceptionIssueId);
    const restoreType = it.sourceContainerType ?? it.containerType;
    const restoreId = it.sourceContainerType ? it.sourceContainerId : it.containerId;
    await prisma.item.update({
      where: { id: it.id },
      data: { ...EXCEPTION_NULLS, containerType: restoreType, containerId: restoreId },
    });
    await prisma.itemEvent.create({
      data: { itemId: it.id, fromStatus: it.status, toStatus: it.status, containerType: restoreType, containerId: restoreId, action: "flag:clear", byUserId: userId },
    });
  }
  for (const id of issueIds) await closeIssueIfClear(id, userId);
}

/** Re-buy: return the unit to the pending-purchase pool (REQUESTED, in its
 *  origin REQUEST) so a replacement is bought. The loss Issue stays open. Only
 *  items that originated from a request can be returned. */
export async function returnToPool(itemIds: number[], userId: number): Promise<void> {
  const items = await prisma.item.findMany({ where: { id: { in: itemIds } } });
  for (const it of items) {
    if (it.requestId == null) continue;
    await prisma.item.update({
      where: { id: it.id },
      data: {
        ...EXCEPTION_NULLS,
        status: "REQUESTED",
        containerType: "REQUEST",
        containerId: it.requestId,
        receivedAt: null,
        transitAt: null,
        globalShippingAt: null,
      },
    });
    await prisma.itemEvent.create({
      data: { itemId: it.id, fromStatus: it.status, toStatus: "REQUESTED", containerType: "REQUEST", containerId: it.requestId, action: "rebuy", byUserId: userId },
    });
  }
}

/** Move flagged items to a chosen container (errant correction). Re-points to a
 *  TRIP (keeps status) or HUB (received), clears the flag, resolves the Issue. */
export async function moveException(itemIds: number[], target: { type: "TRIP" | "HUB"; id: number }, userId: number): Promise<void> {
  const items = await prisma.item.findMany({ where: { id: { in: itemIds } }, select: { id: true, exceptionIssueId: true } });
  if (!items.length) return;
  const issueIds = new Set(items.map((i) => i.exceptionIssueId).filter((x): x is number => x != null));
  await prisma.item.updateMany({ where: { id: { in: itemIds } }, data: EXCEPTION_NULLS });
  await moveItems(itemIds, { containerType: target.type, containerId: target.id, status: target.type === "HUB" ? "HUB" : undefined, action: "errant-move" }, userId);
  for (const id of issueIds) await closeIssueIfClear(id, userId);
}

/** Route a Delayed item to a specific trip (re-point to the trip, keep status). */
export async function assignDelayedToTrip(itemIds: number[], tripId: number, userId: number): Promise<void> {
  if (!itemIds.length) return;
  await prisma.item.updateMany({ where: { id: { in: itemIds } }, data: EXCEPTION_NULLS });
  await moveItems(itemIds, { containerType: "TRIP", containerId: tripId, action: "delayed-assign" }, userId);
}

export interface ExceptionRow {
  id: number;
  uid: string | null;
  pool: string;
  scope: string;
  productName: string;
  flaggedAt: Date | null;
  note: string | null;
  sourceContainerType: string | null;
  sourceContainerId: number | null;
  issueId: number | null;
  issueUid: string | null;
  hasRequest: boolean;
}

/** All currently-flagged items (oldest first), for the Exceptions triage page. */
export async function listExceptions(): Promise<ExceptionRow[]> {
  const items = await prisma.item.findMany({
    where: { exceptionFlag: { not: null } },
    orderBy: [{ exceptionAt: "asc" }, { id: "asc" }],
    include: { product: { select: { name: true } } },
  });
  const issueIds = [...new Set(items.map((i) => i.exceptionIssueId).filter((x): x is number => x != null))];
  const issues = issueIds.length ? await prisma.issue.findMany({ where: { id: { in: issueIds } }, select: { id: true, uid: true } }) : [];
  const issueUid = new Map(issues.map((i) => [i.id, i.uid]));
  return items.map((it) => ({
    id: it.id,
    uid: it.uid,
    pool: it.exceptionFlag as string,
    scope: it.scope,
    productName: it.product?.name ?? "—",
    flaggedAt: it.exceptionAt,
    note: it.exceptionNote,
    sourceContainerType: it.sourceContainerType,
    sourceContainerId: it.sourceContainerId,
    issueId: it.exceptionIssueId,
    issueUid: it.exceptionIssueId ? issueUid.get(it.exceptionIssueId) ?? null : null,
    hasRequest: it.requestId != null,
  }));
}

/** Active trips for the move/assign target pickers (label = traveler · date). */
export async function tripsForPicker(): Promise<{ id: number; label: string }[]> {
  // Trips still open to receive items (same set purchases can target).
  const trips = await prisma.trip.findMany({
    where: { archivedAt: null, status: { in: ["APPROVED", "STARTED_SHIPPING"] } },
    orderBy: { lastReceivingDate: "asc" },
    select: { id: true, lastReceivingDate: true, traveler: { select: { name: true } } },
    take: 100,
  });
  return trips.map((t) => ({ id: t.id, label: `${t.traveler?.name ?? "—"}${t.lastReceivingDate ? ` · ${t.lastReceivingDate.toISOString().slice(0, 10)}` : ""}` }));
}

export async function hubsForPicker(): Promise<{ id: number; label: string }[]> {
  const hubs = await prisma.hub.findMany({ where: { archivedAt: null, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, country: true } });
  return hubs.map((h) => ({ id: h.id, label: `${h.name} · ${h.country}` }));
}
