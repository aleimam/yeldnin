"use server";
import { revalidatePath } from "next/cache";
import { requireModule } from "@/lib/auth/access";
import { saveCategoryBatch, saveAccountBatch } from "@/lib/expenses/expenses-service";
import { writeAudit } from "@/lib/audit";

const on = (fd: FormData, k: string) => fd.get(k) === "on";
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const idList = (fd: FormData) => str(fd, "ids").split(",").filter(Boolean).map(Number);

/** Save All for expense categories. */
export async function saveCategoriesAction(fd: FormData): Promise<void> {
  const access = await requireModule("expenses", "MANAGE");
  const rows = idList(fd).map((id) => ({
    id,
    remove: on(fd, `remove_${id}`),
    name: str(fd, `name_${id}`),
    type: str(fd, `type_${id}`),
    enabled: on(fd, `enabled_${id}`),
  }));
  const newName = str(fd, "new_name");
  await saveCategoryBatch(rows, newName ? { name: newName, type: str(fd, "new_type") } : null);
  await writeAudit(access.user.id, "expenses", "expense.categories.save", "expenseCategory", "batch", { rows: rows.length });
  revalidatePath("/settings/expenses/categories");
}

/** Save All for expense accounts. */
export async function saveAccountsAction(fd: FormData): Promise<void> {
  const access = await requireModule("expenses", "MANAGE");
  const rows = idList(fd).map((id) => ({
    id,
    remove: on(fd, `remove_${id}`),
    name: str(fd, `name_${id}`),
    enabled: on(fd, `enabled_${id}`),
  }));
  const newName = str(fd, "new_name");
  await saveAccountBatch(rows, newName ? { name: newName } : null);
  await writeAudit(access.user.id, "expenses", "expense.accounts.save", "expenseAccount", "batch", { rows: rows.length });
  revalidatePath("/settings/expenses/accounts");
}
