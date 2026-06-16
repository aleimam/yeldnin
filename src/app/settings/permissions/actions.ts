"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/access";
import { isLevel, type Level } from "@/lib/auth/access-logic";
import { capabilitiesForModule } from "@/lib/auth/capabilities";
import { setModulePolicy, resetModulePolicy } from "@/lib/auth/access-policy-service";
import { writeAudit } from "@/lib/audit";

/** Save one module's capability→minimum-level overrides. Admin only. */
export async function setModulePolicyAction(
  moduleKey: string,
  levels: Record<string, string>,
): Promise<void> {
  const access = await requireAdmin();
  // Keep only this module's known capabilities with valid levels.
  const valid: Record<string, Level> = {};
  for (const c of capabilitiesForModule(moduleKey)) {
    const v = levels[c.key];
    if (isLevel(v)) valid[c.key] = v;
  }
  await setModulePolicy(moduleKey, valid);
  await writeAudit(access.user.id, "settings", "access.policy.update", "module", moduleKey, { levels: valid });
  revalidatePath("/settings/permissions");
}

/** Drop a module's overrides, restoring the in-code defaults. Admin only. */
export async function resetModulePolicyAction(moduleKey: string): Promise<void> {
  const access = await requireAdmin();
  await resetModulePolicy(moduleKey);
  await writeAudit(access.user.id, "settings", "access.policy.reset", "module", moduleKey);
  revalidatePath("/settings/permissions");
}
