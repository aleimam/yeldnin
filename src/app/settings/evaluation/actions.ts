"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/access";
import { writeAudit } from "@/lib/audit";
import { saveAiConfig } from "@/lib/evaluation/eval-ai-config-service";
import { testAiConfig } from "@/lib/evaluation/eval-ai-service";
import { saved, saveError, type SaveState } from "@/lib/forms/action-state";

export async function saveAiConfigAction(prev: SaveState, fd: FormData): Promise<SaveState> {
  const access = await requireAdmin();
  const apiKey = String(fd.get("apiKey") ?? "");
  const model = String(fd.get("model") ?? "");
  try {
    await saveAiConfig({ apiKey, model }, access.user.id);
    await writeAudit(access.user.id, "settings", "ai.config", "apiIntegration", 0, { model, keySet: !!apiKey.trim() });
    revalidatePath("/settings/evaluation");
    return saved(prev);
  } catch {
    return saveError(prev);
  }
}

export async function testAiConfigAction(): Promise<void> {
  await requireAdmin();
  await testAiConfig();
  revalidatePath("/settings/evaluation");
}
