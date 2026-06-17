"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/access";
import { saveSla } from "@/lib/sla/sla-config-service";
import { writeAudit } from "@/lib/audit";
import type { SlaSettings } from "@/lib/sla/sla-logic";

export async function saveSlaAction(settings: SlaSettings): Promise<{ ok: true }> {
  const access = await requireAdmin();
  await saveSla(settings);
  await writeAudit(access.user.id, "settings", "settings.sla.save", "sla", "config");
  revalidatePath("/settings/sla");
  return { ok: true };
}
