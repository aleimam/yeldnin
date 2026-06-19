"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { writeAudit } from "@/lib/audit";
import { isExceptionPool } from "@/lib/exceptions/exception-logic";
import {
  flagToPool,
  recoverItem,
  closeException,
  convertErrant,
  rebuyReplacement,
  assignDelayedToTrip,
  settleIssue,
  type RecoverDest,
} from "@/lib/exceptions/exception-service";

/** Logistics or Operations (OPERATE), or an admin, may flag and resolve exceptions. */
async function requireExceptionAccess() {
  const access = await requireUser();
  if (access.isAdmin || access.can("logistics", "operate") || access.can("operations", "operate")) return access;
  redirect("/");
}

function revalidateExceptions() {
  revalidatePath("/exceptions");
  revalidatePath("/history");
  revalidatePath("/issues");
}

export type FlagResult = { ok: true } | { ok: false; error: string };

export async function flagItemsAction(
  itemIds: number[],
  pool: string,
  opts: { note?: string | null; photoAssetIds?: string[] },
): Promise<FlagResult> {
  const access = await requireExceptionAccess();
  if (!isExceptionPool(pool)) return { ok: false, error: "Unknown exception type." };
  if (!itemIds.length) return { ok: false, error: "No items selected." };
  try {
    await flagToPool(itemIds, pool, { note: opts.note, photoAssetIds: opts.photoAssetIds }, access.user.id);
    await writeAudit(access.user.id, "logistics", "item.flag", "item", itemIds[0], { pool, count: itemIds.length });
    revalidateExceptions();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not flag the items." };
  }
}

/** Recover items to a normal status at a chosen destination. */
export async function recoverItemAction(itemIds: number[], destKind: "ORIGINAL" | "HUB" | "TRIP" | "TRAVELER", destId?: number): Promise<void> {
  const access = await requireExceptionAccess();
  const dest: RecoverDest = destKind === "ORIGINAL" ? { kind: "ORIGINAL" } : { kind: destKind, id: destId ?? 0 };
  await recoverItem(itemIds, dest, access.user.id);
  await writeAudit(access.user.id, "logistics", "item.recover", "item", itemIds[0] ?? 0, { destKind, destId, count: itemIds.length });
  revalidateExceptions();
}

/** Settle a lost/damaged loss (compensated / no compensation). */
export async function closeExceptionAction(itemIds: number[], outcome: "COMPENSATED" | "NO_COMPENSATION"): Promise<void> {
  const access = await requireExceptionAccess();
  await closeException(itemIds, outcome, access.user.id);
  await writeAudit(access.user.id, "logistics", "item.settle", "item", itemIds[0] ?? 0, { outcome, count: itemIds.length });
  revalidateExceptions();
}

/** Convert an Errant item to a loss (Lost/Damaged). */
export async function convertErrantAction(itemIds: number[], to: "LOST" | "DAMAGED"): Promise<void> {
  const access = await requireExceptionAccess();
  await convertErrant(itemIds, to, access.user.id);
  await writeAudit(access.user.id, "logistics", "item.convert", "item", itemIds[0] ?? 0, { to, count: itemIds.length });
  revalidateExceptions();
}

/** Re-buy: create a replacement unit in the purchase pool. */
export async function rebuyReplacementAction(itemIds: number[]): Promise<void> {
  const access = await requireExceptionAccess();
  await rebuyReplacement(itemIds, access.user.id);
  await writeAudit(access.user.id, "logistics", "item.rebuy", "item", itemIds[0] ?? 0, { count: itemIds.length });
  revalidateExceptions();
  revalidatePath("/purchasing/pool");
}

/** Settle an exception Issue from its Issue page (closes the issue's items). */
export async function settleIssueAction(issueId: number, outcome: "COMPENSATED" | "NO_COMPENSATION"): Promise<void> {
  const access = await requireExceptionAccess();
  await settleIssue(issueId, outcome, access.user.id);
  await writeAudit(access.user.id, "logistics", "issue.settle", "issue", issueId, { outcome });
  revalidateExceptions();
  revalidatePath(`/issues/${issueId}`);
}

export async function assignDelayedAction(itemIds: number[], tripId: number): Promise<void> {
  const access = await requireExceptionAccess();
  await assignDelayedToTrip(itemIds, tripId, access.user.id);
  await writeAudit(access.user.id, "logistics", "item.delayedAssign", "item", itemIds[0] ?? 0, { tripId, count: itemIds.length });
  revalidateExceptions();
  revalidatePath(`/trips/${tripId}`);
}
