import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import {
  listExpenses,
  listExpenseCategories,
  listXoonxRequestOptions,
  pettyCashBalance,
  isMonthClosed,
} from "@/lib/xoonx/xoonx-finance-service";
import { monthKey } from "@/lib/xoonx/xoonx-finance-logic";
import { ExpenseManager } from "./ExpenseManager";

export default async function XoonxExpensesPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const access = await requireModule("xoonx", "VIEW");
  const canManage = access.can("xoonx", "operate");
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : monthKey(new Date());

  const [t, expenses, categories, requests, petty, closed] = await Promise.all([
    getT(),
    listExpenses(month),
    listExpenseCategories(),
    listXoonxRequestOptions(),
    pettyCashBalance(),
    isMonthClosed(month),
  ]);
  const monthTotal = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <AppShell access={access} moduleKey="xoonx" pageTitle={t("xoonx.expenses")}>
      <ExpenseManager
        month={month}
        canManage={canManage}
        closed={closed}
        petty={petty}
        monthTotal={monthTotal}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        requests={requests}
        expenses={expenses.map((e) => ({
          id: e.id,
          date: e.date.toISOString(),
          category: e.categoryNameSnapshot,
          categoryId: e.categoryId,
          amount: e.amount,
          note: e.note,
          requestId: e.requestId,
        }))}
      />
    </AppShell>
  );
}
