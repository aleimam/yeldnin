"use server";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth/access";
import { saveCategoryBatch, saveAccountBatch, deleteCategory, deleteAccount } from "@/lib/expenses/expenses-service";
import { writeAudit } from "@/lib/audit";
import { saved, saveError, type SaveState } from "@/lib/forms/action-state";

const on = (fd: FormData, k: string) => fd.get(k) === "on";
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const idList = (fd: FormData) => str(fd, "ids").split(",").filter(Boolean).map(Number);

/** Save All for expense categories. */
export async function saveCategoriesAction(prev: SaveState, fd: FormData): Promise<SaveState> {
  const access = await requireCapability("expenses", "manageReference");
  const rows = idList(fd).map((id) => ({
    id,
    remove: on(fd, `remove_${id}`),
    name: str(fd, `name_${id}`),
    nameAr: str(fd, `nameAr_${id}`) || null,
    type: str(fd, `type_${id}`),
    enabled: on(fd, `enabled_${id}`),
  }));
  const newName = str(fd, "new_name");
  try {
    await saveCategoryBatch(rows, newName ? { name: newName, nameAr: str(fd, "new_nameAr") || null, type: str(fd, "new_type") } : null);
    await writeAudit(access.user.id, "expenses", "expense.categories.save", "expenseCategory", "batch", { rows: rows.length });
    revalidatePath("/settings/expenses/categories");
    return saved(prev);
  } catch {
    return saveError(prev);
  }
}

/** Save All for expense accounts. */
export async function saveAccountsAction(prev: SaveState, fd: FormData): Promise<SaveState> {
  const access = await requireCapability("expenses", "manageReference");
  const rows = idList(fd).map((id) => ({
    id,
    remove: on(fd, `remove_${id}`),
    name: str(fd, `name_${id}`),
    enabled: on(fd, `enabled_${id}`),
  }));
  const newName = str(fd, "new_name");
  try {
    await saveAccountBatch(rows, newName ? { name: newName } : null);
    await writeAudit(access.user.id, "expenses", "expense.accounts.save", "expenseAccount", "batch", { rows: rows.length });
    revalidatePath("/settings/expenses/accounts");
    return saved(prev);
  } catch {
    return saveError(prev);
  }
}

/** Soft-delete a single expense category. */
export async function deleteCategoryAction(id: number): Promise<void> {
  const access = await requireCapability("expenses", "manageReference");
  await deleteCategory(id);
  await writeAudit(access.user.id, "expenses", "expense.category.delete", "expenseCategory", id);
  revalidatePath("/settings/expenses/categories");
}

/** Soft-delete a single expense account. */
export async function deleteAccountAction(id: number): Promise<void> {
  const access = await requireCapability("expenses", "manageReference");
  await deleteAccount(id);
  await writeAudit(access.user.id, "expenses", "expense.account.delete", "expenseAccount", id);
  revalidatePath("/settings/expenses/accounts");
}
