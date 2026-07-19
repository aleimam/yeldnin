"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/access";
import {
  saveBackupConfig,
  saveTiers,
  testBackupConnection,
  runAllTiersNow,
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

/** Runs EVERY enabled tier once — one click proves each folder and each
 *  contents choice end to end. */
export async function runBackupNowAction(): Promise<{ ok: boolean; error?: string; fileName?: string }> {
  const access = await requireAdmin();
  const results = await runAllTiersNow(access.user.id);
  revalidatePath("/settings/backup");
  if (!results.length) return { ok: false, error: "No tier is enabled." };
  const failed = results.filter((r) => !r.ok);
  if (failed.length) return { ok: false, error: failed.map((f) => `${f.tier}: ${f.error}`).join(" · ") };
  return { ok: true, fileName: results.map((r) => `${r.tier} → ${r.fileName}`).join(" · ") };
}
