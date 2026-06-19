"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { writeAudit } from "@/lib/audit";
import { isExceptionPool } from "@/lib/exceptions/exception-logic";
import {
  flagToPool,
  clearException,
  returnToPool,
  moveException,
  assignDelayedToTrip,
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

export async function clearExceptionAction(itemIds: number[]): Promise<void> {
  const access = await requireExceptionAccess();
  await clearException(itemIds, access.user.id);
  await writeAudit(access.user.id, "logistics", "item.exceptionClear", "item", itemIds[0] ?? 0, { count: itemIds.length });
  revalidateExceptions();
}

export async function returnToPoolAction(itemIds: number[]): Promise<void> {
  const access = await requireExceptionAccess();
  await returnToPool(itemIds, access.user.id);
  await writeAudit(access.user.id, "logistics", "item.rebuy", "item", itemIds[0] ?? 0, { count: itemIds.length });
  revalidateExceptions();
  revalidatePath("/purchasing/pool");
}

export async function moveExceptionAction(itemIds: number[], targetType: "TRIP" | "HUB", targetId: number): Promise<void> {
  const access = await requireExceptionAccess();
  await moveException(itemIds, { type: targetType, id: targetId }, access.user.id);
  await writeAudit(access.user.id, "logistics", "item.exceptionMove", "item", itemIds[0] ?? 0, { targetType, targetId, count: itemIds.length });
  revalidateExceptions();
}

export async function assignDelayedAction(itemIds: number[], tripId: number): Promise<void> {
  const access = await requireExceptionAccess();
  await assignDelayedToTrip(itemIds, tripId, access.user.id);
  await writeAudit(access.user.id, "logistics", "item.delayedAssign", "item", itemIds[0] ?? 0, { tripId, count: itemIds.length });
  revalidateExceptions();
  revalidatePath(`/trips/${tripId}`);
}
