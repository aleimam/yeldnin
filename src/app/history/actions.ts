"use server";
import { requireModule } from "@/lib/auth/access";
import { findItemIdByUid } from "@/lib/history/history-service";
import { historyScopes } from "@/lib/history/history-logic";

/** Resolve an item UID to its id (for the History search box), scoped to what
 *  the caller may see so it can't confirm an off-scope item's existence. */
export async function lookupItemAction(uid: string): Promise<{ id: number | null }> {
  const access = await requireModule("history", "VIEW");
  if (!uid.trim()) return { id: null };
  return { id: await findItemIdByUid(uid, historyScopes(access)) };
}
