"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/access";
import { writeAudit } from "@/lib/audit";
import {
  saveVeeeyConnection,
  regenerateInboundKey,
  testVeeeyConnection,
  type SaveConnectionInput,
  type TestResult,
} from "@/lib/integrations/integrations-service";

export type SaveResult = { ok: true } | { ok: false; error: string };

export async function saveVeeeyConnectionAction(input: SaveConnectionInput): Promise<SaveResult> {
  const access = await requireAdmin();
  try {
    await saveVeeeyConnection(input, access.user.id);
    await writeAudit(access.user.id, "settings", "integration.save", "integration", "VEEEY");
    revalidatePath("/settings/integrations");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not save." };
  }
}

/** Returns the new inbound key in plaintext — shown to the admin once, then only
 *  its hash is kept. */
export async function regenerateInboundKeyAction(): Promise<{ ok: true; key: string } | { ok: false; error: string }> {
  const access = await requireAdmin();
  try {
    const key = await regenerateInboundKey(access.user.id);
    await writeAudit(access.user.id, "settings", "integration.inboundKey", "integration", "VEEEY");
    revalidatePath("/settings/integrations");
    return { ok: true, key };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not generate the key." };
  }
}

export async function testVeeeyConnectionAction(): Promise<TestResult> {
  const access = await requireAdmin();
  const result = await testVeeeyConnection(access.user.id);
  await writeAudit(access.user.id, "settings", "integration.test", "integration", "VEEEY", { ok: result.ok });
  revalidatePath("/settings/integrations");
  return result;
}
