"use server";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth/access";
import { validatePatch } from "@/lib/patches/patch-logic";
import { createPatch, markPatchDelivered, markPatchReceived } from "@/lib/patches/patch-service";
import { writeAudit } from "@/lib/audit";

export interface PatchPayload {
  purchaseId: number;
  itemIds: number[];
  tracking?: string;
  carrierId?: number | null;
  notes?: string;
  handlingFee?: number | null;
  handlingFeeCurrency?: string | null;
  photoIds?: string[];
}
export type PatchResult = { ok: true; id: number } | { ok: false; error: string };

export async function createPatchAction(p: PatchPayload): Promise<PatchResult> {
  const access = await requireCapability("logistics", "operate");
  const errs = validatePatch(p);
  if (Object.keys(errs).length) return { ok: false, error: Object.values(errs)[0] };
  try {
    const patch = await createPatch(
      { purchaseId: p.purchaseId, itemIds: p.itemIds, tracking: p.tracking ?? null, carrierId: p.carrierId ?? null, notes: p.notes ?? null, handlingFee: p.handlingFee ?? null, handlingFeeCurrency: p.handlingFeeCurrency ?? null },
      p.photoIds ?? [],
      access.user.id,
    );
    await writeAudit(access.user.id, "logistics", "patch.create", "patch", patch.id, { purchaseId: p.purchaseId });
    revalidatePath("/patches");
    return { ok: true, id: patch.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not create the patch." };
  }
}

export async function markPatchDeliveredAction(id: number): Promise<void> {
  const access = await requireCapability("logistics", "operate");
  await markPatchDelivered(id, access.user.id);
  await writeAudit(access.user.id, "logistics", "patch.delivered", "patch", id);
  revalidatePath(`/patches/${id}`);
  revalidatePath("/patches");
}

export async function markPatchReceivedAction(id: number): Promise<void> {
  const access = await requireCapability("logistics", "operate");
  await markPatchReceived(id, access.user.id);
  await writeAudit(access.user.id, "logistics", "patch.received", "patch", id);
  revalidatePath(`/patches/${id}`);
  revalidatePath("/patches");
}
