"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireModule } from "@/lib/auth/access";

const idList = (fd: FormData) =>
  String(fd.get("ids") ?? "").split(",").filter(Boolean).map(Number);

/** Save All for expense categories: batch-update every row + soft-delete + add. */
export async function saveCategoriesAction(fd: FormData): Promise<void> {
  await requireModule("expenses", "MANAGE");
  const ops = [];
  for (const id of idList(fd)) {
    if (fd.get(`remove_${id}`)) {
      ops.push(prisma.expenseCategory.update({ where: { id }, data: { deletedAt: new Date() } }));
      continue;
    }
    const name = String(fd.get(`name_${id}`) ?? "").trim();
    if (!name) continue;
    const type = String(fd.get(`type_${id}`) ?? "EXPENSE") === "TRANSFER" ? "TRANSFER" : "EXPENSE";
    ops.push(
      prisma.expenseCategory.update({
        where: { id },
        data: { name, type, enabled: fd.get(`enabled_${id}`) === "on" },
      }),
    );
  }
  const newName = String(fd.get("new_name") ?? "").trim();
  if (newName) {
    const newType = String(fd.get("new_type") ?? "EXPENSE") === "TRANSFER" ? "TRANSFER" : "EXPENSE";
    ops.push(prisma.expenseCategory.create({ data: { name: newName, type: newType } }));
  }
  if (ops.length) await prisma.$transaction(ops);
  revalidatePath("/settings/expenses/categories");
}

/** Save All for expense accounts. */
export async function saveAccountsAction(fd: FormData): Promise<void> {
  await requireModule("expenses", "MANAGE");
  const ops = [];
  for (const id of idList(fd)) {
    if (fd.get(`remove_${id}`)) {
      ops.push(prisma.expenseAccount.update({ where: { id }, data: { deletedAt: new Date() } }));
      continue;
    }
    const name = String(fd.get(`name_${id}`) ?? "").trim();
    if (!name) continue;
    ops.push(
      prisma.expenseAccount.update({
        where: { id },
        data: { name, enabled: fd.get(`enabled_${id}`) === "on" },
      }),
    );
  }
  const newName = String(fd.get("new_name") ?? "").trim();
  if (newName) ops.push(prisma.expenseAccount.create({ data: { name: newName } }));
  if (ops.length) await prisma.$transaction(ops);
  revalidatePath("/settings/expenses/accounts");
}
