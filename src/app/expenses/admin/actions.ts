"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/auth/access";
import {
  createOrUpdateMonthlySalesReport,
  createOrUpdateMonthlyBankCollectionReport,
} from "@/lib/expenses/expenses-service";
import { saved, saveError, type SaveState } from "@/lib/forms/action-state";

const num = (fd: FormData, k: string) => {
  const n = parseFloat(String(fd.get(k) ?? ""));
  return Number.isFinite(n) ? n : 0;
};

export async function saveMonthlySalesAction(prev: SaveState, fd: FormData): Promise<SaveState> {
  const access = await requireCapability("expenses", "manageAdmin");
  const month = num(fd, "month");
  if (month < 1 || month > 12) return saveError(prev);
  try {
    await createOrUpdateMonthlySalesReport(
      {
        year: num(fd, "year"),
        month,
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
    return saved(prev);
  } catch {
    return saveError(prev);
  }
}

export async function saveBankCollectionAction(prev: SaveState, fd: FormData): Promise<SaveState> {
  const access = await requireCapability("expenses", "manageAdmin");
  const month = num(fd, "month");
  if (month < 1 || month > 12) return saveError(prev);
  try {
    const accounts = await prisma.expenseAccount.findMany({ where: { deletedAt: null } });
    const lines = accounts
      .map((a) => ({ accountId: a.id, accountNameSnapshot: a.name, amount: num(fd, `amt_${a.id}`) }))
      .filter((l) => l.amount !== 0);
    await createOrUpdateMonthlyBankCollectionReport(
      { year: num(fd, "year"), month, note: String(fd.get("note") ?? "") || null, lines },
      access,
    );
    revalidatePath("/expenses/admin/bank-collections");
    return saved(prev);
  } catch {
    return saveError(prev);
  }
}
