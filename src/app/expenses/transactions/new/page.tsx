import Link from "next/link";
import { requireCapability } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listCategories, listTransactions } from "@/lib/expenses/expenses-service";
import { ExpenseForm } from "../../ExpenseForm";

export default async function NewTransactionPage() {
  const access = await requireCapability("expenses", "createTxn");
  const [t, categories, recent] = await Promise.all([
    getT(),
    listCategories(),
    listTransactions({ take: 8 }),
  ]);

  return (
    <AppShell access={access} moduleKey="expenses" pageTitle={t("exp.new")} backHref="/expenses/transactions">
      <div className="grid gap-6 lg:grid-cols-2">
        <ExpenseForm categories={categories.map((c) => ({ id: c.id, name: c.name }))} />
        <div className="card p-5">
          <h2 className="mb-3 font-semibold text-ink">{t("exp.recent")}</h2>
          <ul className="divide-y divide-line">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                <Link href={`/expenses/transactions/${r.id}`} className="text-brand hover:underline">
                  {r.categoryNameSnapshot}
                </Link>
                <span className="text-muted">{Math.round(r.amount).toLocaleString()} EGP</span>
              </li>
            ))}
            {recent.length === 0 && <li className="py-2 text-sm text-muted">{t("exp.empty")}</li>}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
