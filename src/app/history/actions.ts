"use server";
import { requireModule } from "@/lib/auth/access";
import { findItemIdByUid } from "@/lib/history/history-service";

/** Resolve an item UID to its id (for the History search box). */
export async function lookupItemAction(uid: string): Promise<{ id: number | null }> {
  await requireModule("history", "VIEW");
  if (!uid.trim()) return { id: null };
  return { id: await findItemIdByUid(uid) };
}
