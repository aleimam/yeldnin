"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireModule, requireCapability } from "@/lib/auth/access";
import { writeAudit } from "@/lib/audit";
import {
  createExpenseTransaction,
  updateExpenseTransaction,
  deleteExpenseTransaction,
  setTransactionFlag,
  clearTransactionFlag,
  canEditAnyExpense,
  canEditOwnExpense,
} from "@/lib/expenses/expenses-service";
import { canEditExpense } from "@/lib/expenses/expenses-logic";
import { deleteAsset } from "@/lib/assets/assets-service";

export type TxResult = { ok: true; id: number } | { ok: false; error: string };
export type FlagResult = { ok: true } | { ok: false; error: string };

interface TxPayload {
  amount: number;
  categoryId: number;
  note?: string;
  accruingDate?: string;
  attachmentIds?: string[];
}

function validate(p: TxPayload): string | null {
  if (!Number.isFinite(p.amount) || p.amount <= 0) return "Amount must be greater than 0.";
  if (!Number.isFinite(p.categoryId) || p.categoryId <= 0) return "Category is required.";
  if (!p.accruingDate || Number.isNaN(new Date(`${p.accruingDate}T00:00:00Z`).getTime())) return "A valid accruing date is required.";
  return null;
}

export async function createTransactionAction(p: TxPayload): Promise<TxResult> {
  const access = await requireCapability("expenses", "createTxn");
  const err = validate(p);
  if (err) return { ok: false, error: err };
  try {
    const tx = await createExpenseTransaction(
      { amount: p.amount, categoryId: p.categoryId, note: p.note ?? null, accruingDate: p.accruingDate ?? null, attachmentAssetIds: p.attachmentIds },
      access,
    );
    revalidatePath("/expenses/transactions");
    revalidatePath("/expenses/transactions/new");
    return { ok: true, id: tx.id };
  } catch {
    return { ok: false, error: "Could not create the transaction." };
  }
}

export async function updateTransactionAction(id: number, p: TxPayload): Promise<TxResult> {
  // Module access only; the service enforces the edit capability per-row.
  const access = await requireModule("expenses", "VIEW");
  const err = validate(p);
  if (err) return { ok: false, error: err };
  try {
    await updateExpenseTransaction(id, { amount: p.amount, categoryId: p.categoryId, note: p.note ?? null, accruingDate: p.accruingDate ?? null }, access);
    if (p.attachmentIds?.length) {
      await prisma.expenseAttachment.createMany({
        data: p.attachmentIds.map((assetId) => ({ transactionId: id, assetId, uploadedById: access.user.id })),
      });
    }
    revalidatePath(`/expenses/transactions/${id}`);
    return { ok: true, id };
  } catch {
    return { ok: false, error: "You can no longer edit this transaction." };
  }
}

export async function deleteTransactionAction(formData: FormData): Promise<void> {
  const access = await requireModule("expenses", "VIEW");
  const id = Number(formData.get("id"));
  let assetIds: string[] = [];
  try {
    assetIds = (await deleteExpenseTransaction(id, access)) ?? [];
  } catch {
    redirect(`/expenses/transactions/${id}`);
  }
  for (const a of assetIds) await deleteAsset(a);
  revalidatePath("/expenses/transactions");
  redirect("/expenses/transactions");
}

export async function deleteAttachmentAction(formData: FormData): Promise<void> {
  const access = await requireModule("expenses", "VIEW");
  const attId = Number(formData.get("attachmentId"));
  if (!Number.isFinite(attId) || attId <= 0) return;
  const att = await prisma.expenseAttachment.findUnique({ where: { id: attId }, include: { transaction: true } });
  if (!att) return;
  const tx = att.transaction;
  const allowed = canEditExpense({
    isManager: canEditAnyExpense(access),
    isOwner: tx.createdById === access.user.id,
    hasEditPermission: canEditOwnExpense(access),
    createdAt: tx.createdAt,
    now: new Date(),
  });
  if (!allowed) return;
  await prisma.expenseAttachment.delete({ where: { id: attId } });
  await deleteAsset(att.assetId);
  await writeAudit(access.user.id, "expenses", "expense.attachment.remove", "expenseTransaction", tx.id, { attachmentId: attId });
  revalidatePath(`/expenses/transactions/${tx.id}`);
}

// ── Review flags (admins/managers; operate users only see them) ──────────────

export async function flagTransactionAction(id: number, flag: string, note: string | null): Promise<FlagResult> {
  const access = await requireCapability("expenses", "flagTxn");
  try {
    await setTransactionFlag(id, flag, note, access);
    revalidatePath(`/expenses/transactions/${id}`);
    revalidatePath("/expenses/transactions");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not flag the transaction." };
  }
}

export async function clearFlagAction(id: number): Promise<FlagResult> {
  const access = await requireCapability("expenses", "flagTxn");
  try {
    await clearTransactionFlag(id, access);
    revalidatePath(`/expenses/transactions/${id}`);
    revalidatePath("/expenses/transactions");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not clear the flag." };
  }
}
