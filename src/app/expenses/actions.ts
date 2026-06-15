"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireModule } from "@/lib/auth/access";
import { writeAudit } from "@/lib/audit";
import {
  createExpenseTransaction,
  updateExpenseTransaction,
  deleteExpenseTransaction,
  isExpensesManager,
} from "@/lib/expenses/expenses-service";
import { canEditExpense } from "@/lib/expenses/expenses-logic";

export type TxResult = { ok: true; id: number } | { ok: false; error: string };

interface TxPayload {
  amount: number;
  categoryId: number;
  note?: string;
  attachmentIds?: string[];
}

function validate(p: TxPayload): string | null {
  if (!Number.isFinite(p.amount) || p.amount <= 0) return "Amount must be greater than 0.";
  if (!Number.isFinite(p.categoryId) || p.categoryId <= 0) return "Category is required.";
  return null;
}

export async function createTransactionAction(p: TxPayload): Promise<TxResult> {
  const access = await requireModule("expenses", "OPERATE");
  const err = validate(p);
  if (err) return { ok: false, error: err };
  try {
    const tx = await createExpenseTransaction(
      { amount: p.amount, categoryId: p.categoryId, note: p.note ?? null, attachmentAssetIds: p.attachmentIds },
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
  const access = await requireModule("expenses", "OPERATE");
  const err = validate(p);
  if (err) return { ok: false, error: err };
  try {
    await updateExpenseTransaction(id, { amount: p.amount, categoryId: p.categoryId, note: p.note ?? null }, access);
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
  try {
    await deleteExpenseTransaction(id, access);
  } catch {
    redirect(`/expenses/transactions/${id}`);
  }
  revalidatePath("/expenses/transactions");
  redirect("/expenses/transactions");
}

export async function deleteAttachmentAction(formData: FormData): Promise<void> {
  const access = await requireModule("expenses", "OPERATE");
  const attId = Number(formData.get("attachmentId"));
  if (!Number.isFinite(attId) || attId <= 0) return;
  const att = await prisma.expenseAttachment.findUnique({ where: { id: attId }, include: { transaction: true } });
  if (!att) return;
  const tx = att.transaction;
  const allowed = canEditExpense({
    isManager: isExpensesManager(access),
    isOwner: tx.createdById === access.user.id,
    hasEditPermission: access.canModule("expenses", "OPERATE"),
    createdAt: tx.createdAt,
    now: new Date(),
  });
  if (!allowed) return;
  await prisma.expenseAttachment.delete({ where: { id: attId } });
  await writeAudit(access.user.id, "expense.attachment.remove", "expenseTransaction", tx.id, { attachmentId: attId });
  revalidatePath(`/expenses/transactions/${tx.id}`);
}
