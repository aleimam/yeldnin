import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { getExpensesDashboard } from "@/lib/expenses/expenses-service";
import { ExpensesNav } from "../ExpensesNav";

const RECON_COLOR: Record<string, string> = {
  GREEN: "bg-green-100 text-green-700",
  YELLOW: "bg-amber-100 text-amber-700",
  RED: "bg-red-100 text-red-700",
};

export default async function ExpensesDashboard() {
  const access = await requireModule("expenses", "VIEW");
  const [t, d] = await Promise.all([getT(), getExpensesDashboard()]);
  const egp = (n: number) => `${Math.round(n).toLocaleString()} EGP`;
  const maxBar = Math.max(1, ...d.byMonth.map((m) => Math.max(m.expenses, m.transfers)));

  return (
    <AppShell user={access.user} title={t("module.expenses.name")} backHref="/">
      <ExpensesNav canManage={access.canModule("expenses", "MANAGE")} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="card p-5">
          <div className="text-sm text-muted">{t("exp.monthExpenses")}</div>
          <div className="mt-1 text-2xl font-bold text-ink">{egp(d.monthExpensesTotal)}</div>
        </div>
        <div className="card p-5">
          <div className="text-sm text-muted">{t("exp.monthTransfers")}</div>
          <div className="mt-1 text-2xl font-bold text-ink">{egp(d.monthTransfersTotal)}</div>
        </div>
        {d.latestReconciliation && (
          <div className="card p-5">
            <div className="text-sm text-muted">{t("exp.reconciliation")} · {d.latestReconciliation.year}-{String(d.latestReconciliation.month).padStart(2, "0")}</div>
            <div className="mt-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${RECON_COLOR[d.latestReconciliation.result.status]}`}>
                {d.latestReconciliation.result.status} · {egp(d.latestReconciliation.result.difference)}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-3 font-semibold text-ink">{t("exp.topCategories")}</h2>
          <ul className="space-y-2">
            {d.topCategories.map((c) => (
              <li key={c.name} className="flex justify-between text-sm">
                <span className="text-ink">{c.name}</span>
                <span className="text-muted">{egp(c.total)}</span>
              </li>
            ))}
            {d.topCategories.length === 0 && <li className="text-sm text-muted">—</li>}
          </ul>
        </div>

        <div className="card p-5">
          <h2 className="mb-3 font-semibold text-ink">{t("exp.trend")}</h2>
          <div className="space-y-2">
            {d.byMonth.map((m) => (
              <div key={m.label} className="text-xs">
                <div className="mb-0.5 flex justify-between text-muted">
                  <span>{m.label}</span>
                  <span>{egp(m.expenses)}</span>
                </div>
                <div className="h-2 w-full rounded bg-canvas">
                  <div className="h-2 rounded bg-brand" style={{ width: `${(m.expenses / maxBar) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
