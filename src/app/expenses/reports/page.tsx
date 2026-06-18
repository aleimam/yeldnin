import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { getExpenseReports } from "@/lib/expenses/expenses-service";

export default async function ExpenseReportsPage() {
  const access = await requireModule("expenses", "VIEW");
  const [t, r] = await Promise.all([getT(), getExpenseReports()]);
  const egp = (n: number) => `${Math.round(n).toLocaleString()} EGP`;

  return (
    <AppShell access={access} moduleKey="expenses" pageTitle={t("exp.reports")}>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-5">
          <h2 className="mb-3 font-semibold text-ink">{t("exp.categories")}</h2>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-line">
              {r.byCategory.map((c) => (
                <tr key={`${c.name}-${c.type}`}>
                  <td className="py-1.5">{c.name}</td>
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
