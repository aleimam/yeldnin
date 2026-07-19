"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/access";
import {
  saveBackupConfig,
  saveTiers,
  testBackupConnection,
  runTierNow,
  MANUAL_TIER_KEY,
  type SaveBackupInput,
  type SaveTierInput,
} from "@/lib/backup/backup-service";

export async function saveBackupAction(
  input: SaveBackupInput,
  tiers?: SaveTierInput[],
): Promise<{ ok: boolean; error?: string }> {
  const access = await requireAdmin();
  try {
    await saveBackupConfig(input, access.user.id);
    if (tiers?.length) await saveTiers(tiers, access.user.id);
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

/** "Backup now" → the MANUAL level, so an ad-hoc backup lands in its own folder
 *  instead of consuming a scheduled level's retention slot. */
export async function runBackupNowAction(): Promise<{ ok: boolean; error?: string; fileName?: string }> {
  const access = await requireAdmin();
  const r = await runTierNow(access.user.id, MANUAL_TIER_KEY);
  revalidatePath("/settings/backup");
  return { ok: r.ok, error: r.error, fileName: r.fileName };
}

/** Run one specific level on demand — lets a single folder/contents choice be
 *  proven without waiting for its schedule. */
export async function runTierNowAction(key: string): Promise<{ ok: boolean; error?: string; fileName?: string }> {
  const access = await requireAdmin();
  const r = await runTierNow(access.user.id, key);
  revalidatePath("/settings/backup");
  return { ok: r.ok, error: r.error, fileName: r.fileName };
}
