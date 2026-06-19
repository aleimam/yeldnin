"use server";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth/access";
import { writeAudit } from "@/lib/audit";
import { validateTransfer } from "@/lib/transfers/transfer-logic";
import { createTransfer, advanceTransfer, eligibleItemsAt, type CreateTransferInput } from "@/lib/transfers/transfer-service";

export type TransferResult = { ok: true; id: number } | { ok: false; error: string };

export async function createTransferAction(input: CreateTransferInput): Promise<TransferResult> {
  const access = await requireCapability("logistics", "operate");
  const errs = validateTransfer({ fromType: input.fromType, fromId: input.fromId, toType: input.toType, toId: input.toId, itemCount: input.itemIds.length });
  if (Object.keys(errs).length) return { ok: false, error: Object.values(errs)[0] };
  try {
    const transfer = await createTransfer(input, access.user.id);
    await writeAudit(access.user.id, "logistics", "transfer.create", "transfer", transfer.id, {
      from: `${input.fromType}#${input.fromId}`,
      to: `${input.toType}#${input.toId}`,
      count: input.itemIds.length,
    });
    revalidatePath("/transfers");
    return { ok: true, id: transfer.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not create the transfer." };
  }
}

/** Eligible (received, un-flagged) items at a source endpoint — for the create form. */
export async function eligibleItemsAction(type: string, id: number): Promise<{ id: number; label: string }[]> {
  await requireCapability("logistics", "operate");
  const items = await eligibleItemsAt(type, id);
  return items.map((it) => ({ id: it.id, label: `${it.product?.name ?? "—"} ${it.uid ?? `#${it.id}`}` }));
}

export async function advanceTransferAction(id: number): Promise<void> {
  const access = await requireCapability("logistics", "operate");
  await advanceTransfer(id, access.user.id);
  await writeAudit(access.user.id, "logistics", "transfer.advance", "transfer", id);
  revalidatePath(`/transfers/${id}`);
  revalidatePath("/transfers");
}
