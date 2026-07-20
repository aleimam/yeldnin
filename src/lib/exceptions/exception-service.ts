import "server-only";
import { prisma } from "@/lib/db";
import { nextUid } from "@/lib/uid";
import { moveItems, createItems } from "@/lib/items/items-service";
import { getWorkflow } from "@/lib/workflow/workflow-config-service";
import { autoAdvanceSchedule } from "@/lib/workflow/workflow-logic";
import { poolOpensIssue } from "./exception-logic";
import { sendLocalizedToUsers, resolveRecipients } from "@/lib/notify/notify-service";
import { itemsFlaggedPayload, issueOpenedPayload } from "@/lib/notify/notify-logic";
import { issueEventRecipients } from "@/lib/issues/issues-service";

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
    await sendLocalizedToUsers(await issueEventRecipients("issue.opened", issue.scope), (t) => issueOpenedPayload(t, issue)).catch(() => {});
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

const EXCEPTION_NULLS = {
  exceptionFlag: null,
  sourceContainerType: null,
  sourceContainerId: null,
  exceptionNote: null,
  exceptionAt: null,
  exceptionById: null,
  exceptionIssueId: null,
} as const;

/** Solve an exception Issue with an outcome once none of its items remain
 *  flagged (used when recovering). */
async function closeIssueIfClear(issueId: number, userId: number, outcome: string): Promise<void> {
  const stillFlagged = await prisma.item.count({ where: { exceptionIssueId: issueId, exceptionFlag: { not: null } } });
  if (stillFlagged === 0) {
    await prisma.issue.update({ where: { id: issueId }, data: { status: "SOLVED", resolvedAt: new Date(), outcome, updatedById: userId } }).catch(() => {});
  }
}

export type RecoverDest = { kind: "ORIGINAL" } | { kind: "HUB" | "TRIP" | "TRAVELER"; id: number };

/** Recover a flagged item to a normal status at a chosen destination: its
 *  original container (keeps status), or a hub/trip (re-receives → HUB + fresh
 *  timers), or a traveler holding (held — no timers). A linked Issue closes as
 *  RECOVERED once all its items are recovered. */
export async function recoverItem(itemIds: number[], dest: RecoverDest, userId: number): Promise<void> {
  const items = await prisma.item.findMany({ where: { id: { in: itemIds } } });
  if (!items.length) return;
  const issueIds = new Set<number>();
  const wf = dest.kind === "HUB" || dest.kind === "TRIP" ? await getWorkflow() : null;
  const now = new Date();
  for (const it of items) {
    if (it.exceptionIssueId) issueIds.add(it.exceptionIssueId);
    if (dest.kind === "ORIGINAL") {
      const ctype = it.sourceContainerType ?? it.containerType;
      const cid = it.sourceContainerType ? it.sourceContainerId : it.containerId;
      await prisma.item.update({ where: { id: it.id }, data: { ...EXCEPTION_NULLS, containerType: ctype, containerId: cid } });
      await prisma.itemEvent.create({ data: { itemId: it.id, fromStatus: it.status, toStatus: it.status, containerType: ctype, containerId: cid, action: "recover", byUserId: userId } });
    } else if (dest.kind === "TRAVELER") {
      await prisma.item.update({ where: { id: it.id }, data: { ...EXCEPTION_NULLS, containerType: "TRAVELER", containerId: dest.id, status: "HUB", receivedAt: now, transitAt: null, globalShippingAt: null } });
      await prisma.itemEvent.create({ data: { itemId: it.id, fromStatus: it.status, toStatus: "HUB", containerType: "TRAVELER", containerId: dest.id, action: "recover", byUserId: userId } });
    } else {
      const sched = autoAdvanceSchedule(now, Math.random, wf!.timers);
      await prisma.item.update({ where: { id: it.id }, data: { ...EXCEPTION_NULLS, containerType: dest.kind, containerId: dest.id, status: "HUB", receivedAt: now, transitAt: sched.transitAt, globalShippingAt: sched.globalShippingAt } });
      await prisma.itemEvent.create({ data: { itemId: it.id, fromStatus: it.status, toStatus: "HUB", containerType: dest.kind, containerId: dest.id, action: "recover", byUserId: userId } });
    }
  }
  for (const id of issueIds) await closeIssueIfClear(id, userId, "RECOVERED");
}

/** Settle a lost/damaged loss explicitly. The item stays flagged (terminal);
 *  the linked Issue is SOLVED with the closure outcome. */
export async function closeException(itemIds: number[], outcome: "COMPENSATED" | "NO_COMPENSATION", userId: number): Promise<void> {
  const items = await prisma.item.findMany({ where: { id: { in: itemIds } }, select: { id: true, status: true, exceptionIssueId: true } });
  if (!items.length) return;
  const issueIds = new Set<number>();
  for (const it of items) {
    if (it.exceptionIssueId) issueIds.add(it.exceptionIssueId);
    await prisma.itemEvent.create({ data: { itemId: it.id, fromStatus: it.status, toStatus: it.status, action: `settle:${outcome}`, byUserId: userId } });
  }
  for (const id of issueIds) await prisma.issue.update({ where: { id }, data: { status: "SOLVED", resolvedAt: new Date(), outcome, updatedById: userId } }).catch(() => {});
}

/** Convert an Errant item to a loss (Lost/Damaged). The existing Issue carries
 *  forward; the item then follows the loss lifecycle. */
export async function convertErrant(itemIds: number[], to: "LOST" | "DAMAGED", userId: number): Promise<void> {
  const items = await prisma.item.findMany({ where: { id: { in: itemIds }, exceptionFlag: "ERRANT" }, select: { id: true, status: true } });
  for (const it of items) {
    await prisma.item.update({ where: { id: it.id }, data: { exceptionFlag: to } });
    await prisma.itemEvent.create({ data: { itemId: it.id, fromStatus: it.status, toStatus: it.status, action: `convert:${to}`, byUserId: userId } });
  }
}

/** Re-buy: create a NEW replacement unit in the pending-purchase pool for the
 *  customer's need. The lost/damaged unit stays flagged and is closed separately. */
export async function rebuyReplacement(itemIds: number[], userId: number): Promise<void> {
  const items = await prisma.item.findMany({ where: { id: { in: itemIds } } });
  for (const it of items) {
    if (it.requestId == null) continue;
    await createItems({
      productId: it.productId,
      scope: it.scope,
      count: 1,
      requestId: it.requestId,
      isSpecialOrder: it.isSpecialOrder,
      sellingPrice: it.sellingPrice,
      purchasePrice: it.purchasePrice,
      purchaseCurrency: it.purchaseCurrency,
      status: "REQUESTED",
      containerType: "REQUEST",
      containerId: it.requestId,
      userId,
    });
    await prisma.itemEvent.create({ data: { itemId: it.id, fromStatus: it.status, toStatus: it.status, action: "rebuy-replacement", byUserId: userId } });
  }
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

/** Active travelers for the recover-to-holding destination picker. */
export async function travelersForPicker(): Promise<{ id: number; label: string }[]> {
  const ts = await prisma.traveler.findMany({ where: { archivedAt: null, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  return ts.map((t) => ({ id: t.id, label: t.name }));
}

export async function hubsForPicker(): Promise<{ id: number; label: string }[]> {
  const hubs = await prisma.hub.findMany({ where: { archivedAt: null, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, country: true } });
  return hubs.map((h) => ({ id: h.id, label: `${h.name} · ${h.country}` }));
}

/** Settle a loss from its Issue page: close all the Issue's items + the Issue. */
export async function settleIssue(issueId: number, outcome: "COMPENSATED" | "NO_COMPENSATION", userId: number): Promise<void> {
  const links = await prisma.issueItem.findMany({ where: { issueId }, select: { itemId: true } });
  await closeException(links.map((l) => l.itemId), outcome, userId);
  await prisma.issue.update({ where: { id: issueId }, data: { status: "SOLVED", resolvedAt: new Date(), outcome, updatedById: userId } }).catch(() => {});
}
