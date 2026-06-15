"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireModule } from "@/lib/auth/access";
import {
  createOrUpdateMonthlySalesReport,
  createOrUpdateMonthlyBankCollectionReport,
} from "@/lib/expenses/expenses-service";

const num = (fd: FormData, k: string) => {
  const n = parseFloat(String(fd.get(k) ?? ""));
  return Number.isFinite(n) ? n : 0;
};

export async function saveMonthlySalesAction(fd: FormData): Promise<void> {
  const access = await requireModule("expenses", "MANAGE");
  await createOrUpdateMonthlySalesReport(
    {
      year: num(fd, "year"),
      month: num(fd, "month"),
      totalSales: num(fd, "totalSales"),
      cashToStaff: num(fd, "cashToStaff"),
      cashToAramex: num(fd, "cashToAramex"),
      cashToSmsa: num(fd, "cashToSmsa"),
      bankTransferAndMobileWallet: num(fd, "bankTransferAndMobileWallet"),
      creditCard: num(fd, "creditCard"),
      note: String(fd.get("note") ?? "") || null,
    },
    access,
  );
  revalidatePath("/expenses/admin/monthly-sales");
}

export async function saveBankCollectionAction(fd: FormData): Promise<void> {
  const access = await requireModule("expenses", "MANAGE");
  const accounts = await prisma.expenseAccount.findMany({ where: { deletedAt: null } });
  const lines = accounts
    .map((a) => ({ accountId: a.id, accountNameSnapshot: a.name, amount: num(fd, `amt_${a.id}`) }))
    .filter((l) => l.amount !== 0);
  await createOrUpdateMonthlyBankCollectionReport(
    { year: num(fd, "year"), month: num(fd, "month"), note: String(fd.get("note") ?? "") || null, lines },
    access,
  );
  revalidatePath("/expenses/admin/bank-collections");
}

// ── Categories ──
export async function createCategoryAction(fd: FormData): Promise<void> {
  await requireModule("expenses", "MANAGE");
  const name = String(fd.get("name") ?? "").trim();
  const type = String(fd.get("type") ?? "EXPENSE") === "TRANSFER" ? "TRANSFER" : "EXPENSE";
  if (name) await prisma.expenseCategory.create({ data: { name, type } });
  revalidatePath("/expenses/admin/categories");
}
export async function updateCategoryAction(fd: FormData): Promise<void> {
  await requireModule("expenses", "MANAGE");
  const id = Number(fd.get("id"));
  if (fd.get("delete")) {
    await prisma.expenseCategory.update({ where: { id }, data: { deletedAt: new Date() } });
  } else {
    await prisma.expenseCategory.update({
      where: { id },
      data: {
        name: String(fd.get("name") ?? "").trim(),
        type: String(fd.get("type") ?? "EXPENSE") === "TRANSFER" ? "TRANSFER" : "EXPENSE",
        enabled: fd.get("enabled") === "on",
      },
    });
  }
  revalidatePath("/expenses/admin/categories");
}

// ── Accounts ──
export async function createAccountAction(fd: FormData): Promise<void> {
  await requireModule("expenses", "MANAGE");
  const name = String(fd.get("name") ?? "").trim();
  if (name) await prisma.expenseAccount.create({ data: { name } });
  revalidatePath("/expenses/admin/accounts");
}
export async function updateAccountAction(fd: FormData): Promise<void> {
  await requireModule("expenses", "MANAGE");
  const id = Number(fd.get("id"));
  if (fd.get("delete")) {
    await prisma.expenseAccount.update({ where: { id }, data: { deletedAt: new Date() } });
  } else {
    await prisma.expenseAccount.update({
      where: { id },
      data: { name: String(fd.get("name") ?? "").trim(), enabled: fd.get("enabled") === "on" },
    });
  }
  revalidatePath("/expenses/admin/accounts");
}
