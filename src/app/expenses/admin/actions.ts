"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/auth/access";
import {
  createOrUpdateMonthlySalesReport,
  createOrUpdateMonthlyBankCollectionReport,
} from "@/lib/expenses/expenses-service";

const num = (fd: FormData, k: string) => {
  const n = parseFloat(String(fd.get(k) ?? ""));
  return Number.isFinite(n) ? n : 0;
};

export async function saveMonthlySalesAction(fd: FormData): Promise<void> {
  const access = await requireCapability("expenses", "manageAdmin");
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
  const access = await requireCapability("expenses", "manageAdmin");
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
