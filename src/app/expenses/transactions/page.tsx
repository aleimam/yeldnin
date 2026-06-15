import Link from "next/link";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listTransactions } from "@/lib/expenses/expenses-service";
import { ExpensesNav } from "../ExpensesNav";

export default async function TransactionsPage() {
  const access = await requireModule("expenses", "VIEW");
  const [t, rows] = await Promise.all([getT(), listTransactions({})]);
  const canCreate = access.canModule("expenses", "OPERATE");

  return (
    <AppShell
      user={access.user}
      title={t("module.expenses.name")}
      backHref="/"
      actions={canCreate ? <Link href="/expenses/transactions/new" className="btn-primary">+ {t("exp.new")}</Link> : null}
    >
      <ExpensesNav canManage={access.canModule("expenses", "MANAGE")} />
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-line bg-canvas">
            <tr>
              <th className="th">{t("exp.date")}</th>
              <th className="th">{t("exp.category")}</th>
              <th className="th">{t("exp.type")}</th>
              <th className="th">{t("exp.createdBy")}</th>
              <th className="th text-end">{t("exp.amount")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-canvas/60">
                <td className="td whitespace-nowrap text-muted">
                  <Link href={`/expenses/transactions/${r.id}`} className="text-brand hover:underline">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </Link>
                </td>
                <td className="td">
                  {r.categoryNameSnapshot}
                  {r.attachments.length > 0 && <span className="ms-2 text-xs text-muted">📎{r.attachments.length}</span>}
                </td>
                <td className="td">
                  {r.categoryTypeSnapshot === "TRANSFER" ? t("exp.transfer") : t("exp.expense")}
                </td>
                <td className="td text-muted">{r.createdBy.name}</td>
                <td className="td text-end font-medium">{Math.round(r.amount).toLocaleString()}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td className="td text-muted" colSpan={5}>{t("exp.empty")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
