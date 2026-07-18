"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/access";
import { saveBackupConfig, testBackupConnection, runBackup, type SaveBackupInput } from "@/lib/backup/backup-service";

export async function saveBackupAction(input: SaveBackupInput): Promise<{ ok: boolean; error?: string }> {
  const access = await requireAdmin();
  try {
    await saveBackupConfig(input, access.user.id);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't save the backup settings." };
  }
  revalidatePath("/settings/backup");
  return { ok: true };
}

export async function testBackupAction(): Promise<{ ok: boolean; message: string }> {
  const access = await requireAdmin();
  const res = await testBackupConnection(access.user.id);
  revalidatePath("/settings/backup");
  return res;
}

export async function runBackupNowAction(): Promise<{ ok: boolean; error?: string; fileName?: string }> {
  const access = await requireAdmin();
  const res = await runBackup("MANUAL", access.user.id);
  revalidatePath("/settings/backup");
  return { ok: res.ok, error: res.error, fileName: res.fileName };
}
