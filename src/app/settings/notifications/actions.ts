"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/access";
import { saveNotifyRules } from "@/lib/notify/notify-config-service";
import type { NotifyRule } from "@/lib/notify/notify-logic";

export async function saveNotifyRulesAction(rules: NotifyRule[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await requireAdmin();
  try {
    await saveNotifyRules(rules, access.user.id);
    revalidatePath("/settings/notifications");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not save." };
  }
}
