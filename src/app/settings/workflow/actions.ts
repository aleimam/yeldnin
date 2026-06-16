"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/access";
import { saveWorkflowOverrides } from "@/lib/workflow/workflow-config-service";
import type { WorkflowOverrides } from "@/lib/workflow/workflow-logic";
import { writeAudit } from "@/lib/audit";

/** Save the Status Map overrides (labels / carry-forward / timers). Admin only. */
export async function saveWorkflowAction(overrides: WorkflowOverrides): Promise<void> {
  const access = await requireAdmin();
  await saveWorkflowOverrides(overrides);
  await writeAudit(access.user.id, "settings", "workflow.update", "workflow", "statusMap");
  revalidatePath("/settings/workflow");
}

/** Restore the in-code defaults. Admin only. */
export async function resetWorkflowAction(): Promise<void> {
  const access = await requireAdmin();
  await saveWorkflowOverrides({});
  await writeAudit(access.user.id, "settings", "workflow.reset", "workflow", "statusMap");
  revalidatePath("/settings/workflow");
}
