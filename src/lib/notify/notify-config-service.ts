import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { DEFAULT_NOTIFY_RULES, type NotifyRule } from "./notify-logic";

/** All event rules — DB overrides merged over the code-defined defaults. */
export const getNotifyRules = cache(async (): Promise<Record<string, NotifyRule>> => {
  const rows = await prisma.notificationRule.findMany();
  const merged: Record<string, NotifyRule> = {};
  for (const [event, def] of Object.entries(DEFAULT_NOTIFY_RULES)) merged[event] = { ...def };
  for (const r of rows) {
    if (!merged[r.event]) continue; // ignore stale/unknown events
    merged[r.event] = {
      event: r.event,
      enabled: r.enabled,
      notifyAdmins: r.notifyAdmins,
      notifyOrderCreator: r.notifyOrderCreator,
      moduleKeys: r.moduleKeys,
      statuses: r.statuses,
    };
  }
  return merged;
});

/** Persist the edited rules (known events only). */
export async function saveNotifyRules(rules: NotifyRule[], userId: number): Promise<void> {
  for (const r of rules) {
    if (!DEFAULT_NOTIFY_RULES[r.event]) continue;
    const data = {
      enabled: r.enabled,
      notifyAdmins: r.notifyAdmins,
      notifyOrderCreator: r.notifyOrderCreator,
      moduleKeys: r.moduleKeys,
      statuses: r.statuses,
      updatedById: userId,
    };
    await prisma.notificationRule.upsert({
      where: { event: r.event },
      update: data,
      create: { event: r.event, ...data },
    });
  }
  await writeAudit(userId, "settings", "notify.rules.save", "notificationRule", 0, { count: rules.length });
}
