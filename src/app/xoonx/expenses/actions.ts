"use server";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth/access";
import { createExpense, updateExpense, deleteExpense, type ExpenseInput } from "@/lib/xoonx/xoonx-finance-service";

export type Result = { ok: true } | { ok: false; error: string };
const fail = (e: unknown): Result => ({ ok: false, error: e instanceof Error ? e.message : "Something went wrong." });

export async function createExpenseAction(input: ExpenseInput): Promise<Result> {
  const access = await requireCapability("xoonx", "operate");
  try {
    await createExpense(input, access.user.id);
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/xoonx/expenses");
  return { ok: true };
}
export async function updateExpenseAction(id: number, input: ExpenseInput): Promise<Result> {
  const access = await requireCapability("xoonx", "operate");
  try {
    await updateExpense(id, input, access.user.id);
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/xoonx/expenses");
  return { ok: true };
}
export async function deleteExpenseAction(id: number): Promise<Result> {
  const access = await requireCapability("xoonx", "operate");
  try {
    await deleteExpense(id, access.user.id);
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/xoonx/expenses");
  return { ok: true };
}
