"use server";
import { revalidatePath } from "next/cache";
import { requireModule } from "@/lib/auth/access";
import { pruneOldErrorLogs, clearAllErrorLogs } from "@/lib/errors/error-log-service";
import { writeAudit } from "@/lib/audit";

/** Prune rows older than the 30-day retention window. */
export async function pruneErrorLogsAction(): Promise<{ ok: boolean; deleted?: number }> {
  const access = await requireModule("error_log", "MANAGE");
  const deleted = await pruneOldErrorLogs();
  await writeAudit(access.user.id, "error_log", "errorlog.prune", "errorLog", "batch", { deleted });
  revalidatePath("/error-log");
  return { ok: true, deleted };
}

/** Clear the entire error log. */
export async function clearErrorLogsAction(): Promise<{ ok: boolean; deleted?: number }> {
  const access = await requireModule("error_log", "MANAGE");
  const deleted = await clearAllErrorLogs();
  await writeAudit(access.user.id, "error_log", "errorlog.clear", "errorLog", "batch", { deleted });
  revalidatePath("/error-log");
  return { ok: true, deleted };
}
