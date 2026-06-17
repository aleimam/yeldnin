"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/access";
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
const guard = () => requireAdmin();

function revalidate() {
  revalidatePath("/settings/xoonx");
  revalidatePath("/xoonx/expenses");
}

/** Save all FX rates for the month at once (blanks / non-positive are skipped). */
export async function setFxRatesAction(month: string, rates: { currency: string; rate: number }[]): Promise<Result> {
  const a = await guard();
  try {
    for (const r of rates) if (r.rate > 0) await setFxRate(month, r.currency, r.rate, a.user.id);
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/settings/xoonx");
  return { ok: true };
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
export async function setStaffSharesAction(shares: { userId: number; sharePct: number }[]): Promise<Result> {
  const a = await guard();
  try {
    await setStaffShares(shares, a.user.id);
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/settings/xoonx");
  return { ok: true };
}
