import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT, getLocale } from "@/i18n/server";
import { getExpenseReports, categoryArMap } from "@/lib/expenses/expenses-service";
import { categoryLabel } from "@/lib/expenses/category-label";
import { PieChart } from "@/components/PieChart";

// Distinct slice colors; the first is the brand accent (a CSS variable).
const PALETTE = ["var(--brand)", "#f59e0b", "#10b981", "#6366f1", "#ec4899", "#06b6d4", "#84cc16", "#f43f5e"];

export default async function ExpenseReportsPage() {
  const access = await requireModule("expenses", "VIEW");
  const [t, locale, r, arMap] = await Promise.all([getT(), getLocale(), getExpenseReports(), categoryArMap()]);
  const egp = (n: number) => `${Math.round(n).toLocaleString()} EGP`;
  const s = r.summary;

  const typeSlices = [
    { label: t("exp.expense"), value: r.typeSplit.expenses, color: "var(--brand)", hint: egp(r.typeSplit.expenses) },
    { label: t("exp.transfer"), value: r.typeSplit.transfers, color: "#f59e0b", hint: egp(r.typeSplit.transfers) },
  ];
  const expenseCats = r.byCategory.filter((c) => c.type !== "TRANSFER");
  const topCats = expenseCats.slice(0, 8);
  const otherTotal = expenseCats.slice(8).reduce((a, c) => a + c.total, 0);
  const catSlices = [
    ...topCats.map((c, i) => ({ label: categoryLabel(t, c.name, locale, arMap), value: c.total, color: PALETTE[i % PALETTE.length], hint: egp(c.total) })),
    ...(otherTotal > 0 ? [{ label: t("exp.other"), value: otherTotal, color: "#94a3b8", hint: egp(otherTotal) }] : []),
  ];
  const maxMonth = Math.max(1, ...r.byMonth.map((m) => Math.max(m.expenses, m.transfers)));

  const Metric = ({ label, value }: { label: string; value: string }) => (
    <div className="card p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-lg font-bold text-ink">{value}</div>
    </div>
  );

  return (
    <AppShell access={access} moduleKey="expenses" pageTitle={t("exp.reports")}>
      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Metric label={t("exp.totalExpenses")} value={egp(s.totalExpenses)} />
        <Metric label={t("exp.totalTransfers")} value={egp(s.totalTransfers)} />
        <Metric label={t("exp.txCount")} value={s.txCount.toLocaleString()} />
        <Metric label={t("exp.avgExpense")} value={egp(s.avgExpense)} />
        <Metric label={t("exp.topCategory")} value={s.topCategory ? categoryLabel(t, s.topCategory.name, locale, arMap) : "—"} />
        <Metric label={t("exp.topSpender")} value={s.topSpender?.user ?? "—"} />
      </div>

      {/* Pie charts */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-3 font-semibold text-ink">{t("exp.byTypeChart")}</h2>
          {r.typeSplit.expenses + r.typeSplit.transfers > 0 ? <PieChart slices={typeSlices} /> : <p className="text-sm text-muted">{t("exp.noData")}</p>}
        </div>
        <div className="card p-5">
          <h2 className="mb-3 font-semibold text-ink">{t("exp.byCategoryChart")}</h2>
          {catSlices.length > 0 ? <PieChart slices={catSlices} /> : <p className="text-sm text-muted">{t("exp.noData")}</p>}
        </div>
      </div>

      {/* Monthly trend */}
      <div className="mt-6 card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-ink">{t("exp.month")}</h2>
          <div className="flex gap-3 text-[11px] text-muted">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-brand" />{t("exp.expense")}</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" />{t("exp.transfer")}</span>
          </div>
        </div>
        <div className="space-y-3">
          {r.byMonth.map((m) => (
            <div key={m.label} className="text-xs">
              <div className="mb-0.5 flex justify-between text-muted">
                <span>{m.label}</span>
                <span><span className="text-brand">{egp(m.expenses)}</span> · <span className="text-amber-600">{egp(m.transfers)}</span></span>
              </div>
              <div className="space-y-1">
                <div className="h-2 w-full rounded bg-canvas"><div className="h-2 rounded bg-brand" style={{ width: `${(m.expenses / maxMonth) * 100}%` }} /></div>
                <div className="h-2 w-full rounded bg-canvas"><div className="h-2 rounded bg-amber-500" style={{ width: `${(m.transfers / maxMonth) * 100}%` }} /></div>
              </div>
            </div>
          ))}
          {r.byMonth.length === 0 && <p className="text-sm text-muted">{t("exp.noData")}</p>}
        </div>
      </div>

      {/* Tables */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="card p-5">
          <h2 className="mb-3 font-semibold text-ink">{t("exp.categories")}</h2>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-line">
              {r.byCategory.map((c) => (
                <tr key={`${c.name}-${c.type}`}>
                  <td className="py-1.5">{categoryLabel(t, c.name, locale, arMap)}</td>
                  <td className="py-1.5 text-end text-muted">{egp(c.total)}</td>
                </tr>
              ))}
              {r.byCategory.length === 0 && <tr><td colSpan={2} className="py-1.5 text-muted">{t("exp.empty")}</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card p-5">
          <h2 className="mb-3 font-semibold text-ink">{t("exp.user")}</h2>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-line">
              {r.byUser.map((u) => (
                <tr key={u.user}>
                  <td className="py-1.5">{u.user}</td>
                  <td className="py-1.5 text-end text-muted">{egp(u.total)}</td>
                </tr>
              ))}
              {r.byUser.length === 0 && <tr><td colSpan={2} className="py-1.5 text-muted">{t("exp.empty")}</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card p-5">
          <h2 className="mb-3 font-semibold text-ink">{t("exp.month")}</h2>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-line">
              {r.byMonth.map((m) => (
                <tr key={m.label}>
                  <td className="py-1.5">{m.label}</td>
                  <td className="py-1.5 text-end text-muted">{egp(m.expenses)}</td>
                </tr>
              ))}
              {r.byMonth.length === 0 && <tr><td colSpan={2} className="py-1.5 text-muted">{t("exp.empty")}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
