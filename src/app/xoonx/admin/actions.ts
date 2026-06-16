"use server";
import { revalidatePath } from "next/cache";
import { requireModule } from "@/lib/auth/access";
import {
  createExpenseCategory,
  renameExpenseCategory,
  setCategoryEnabled,
  deleteExpenseCategory,
  setFxRate,
  setStaffShares,
} from "@/lib/xoonx/xoonx-finance-service";

export type Result = { ok: true } | { ok: false; error: string };
const fail = (e: unknown): Result => ({ ok: false, error: e instanceof Error ? e.message : "Something went wrong." });
const guard = () => requireModule("xoonx", "MANAGE");

function revalidate() {
  revalidatePath("/xoonx/admin");
  revalidatePath("/xoonx/expenses");
}

export async function createCategoryAction(name: string): Promise<Result> {
  const a = await guard();
  if (!name.trim()) return { ok: false, error: "Name is required." };
  try {
    await createExpenseCategory(name, a.user.id);
  } catch (e) {
    return fail(e);
  }
  revalidate();
  return { ok: true };
}
export async function renameCategoryAction(id: number, name: string): Promise<Result> {
  const a = await guard();
  if (!name.trim()) return { ok: false, error: "Name is required." };
  try {
    await renameExpenseCategory(id, name, a.user.id);
  } catch (e) {
    return fail(e);
  }
  revalidate();
  return { ok: true };
}
export async function setCategoryEnabledAction(id: number, enabled: boolean): Promise<Result> {
  const a = await guard();
  try {
    await setCategoryEnabled(id, enabled, a.user.id);
  } catch (e) {
    return fail(e);
  }
  revalidate();
  return { ok: true };
}
export async function deleteCategoryAction(id: number): Promise<Result> {
  const a = await guard();
  try {
    await deleteExpenseCategory(id, a.user.id);
  } catch (e) {
    return fail(e);
  }
  revalidate();
  return { ok: true };
}
export async function setFxRateAction(month: string, currency: string, rate: number): Promise<Result> {
  const a = await guard();
  try {
    await setFxRate(month, currency, rate, a.user.id);
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/xoonx/admin");
  return { ok: true };
}
export async function setStaffSharesAction(shares: { userId: number; sharePct: number }[]): Promise<Result> {
  const a = await guard();
  try {
    await setStaffShares(shares, a.user.id);
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/xoonx/admin");
  return { ok: true };
}
