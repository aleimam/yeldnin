import Link from "next/link";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT, getLocale } from "@/i18n/server";
import { listTransactions, categoryArMap } from "@/lib/expenses/expenses-service";
import { displayName } from "@/lib/users/users-logic";
import { categoryLabel } from "@/lib/expenses/category-label";
import { formatBizDate } from "@/lib/format/dates";

export default async function TransactionsPage() {
  const access = await requireModule("expenses", "VIEW");
  const [t, locale, rows, arMap] = await Promise.all([getT(), getLocale(), listTransactions({}), categoryArMap()]);
  const canCreate = access.can("expenses", "createTxn");

  return (
    <AppShell
      access={access}
      moduleKey="expenses"
      actions={canCreate ? <Link href="/expenses/transactions/new" className="btn-primary">+ {t("exp.new")}</Link> : null}
    >
      <div className="card overflow-x-auto">
        <table className="w-full" data-cards>
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
                <td className="td whitespace-nowrap text-muted" data-label={t("exp.date")}>
                  <Link href={`/expenses/transactions/${r.id}`} className="text-brand hover:underline">
                    {formatBizDate(r.createdAt)}
                  </Link>
                </td>
                <td className="td" data-label={t("exp.category")}>
                  {categoryLabel(t, r.categoryNameSnapshot, locale, arMap)}
                  {r.attachments.length > 0 && <span className="ms-2 text-xs text-muted">📎{r.attachments.length}</span>}
                </td>
                <td className="td" data-label={t("exp.type")}>
                  {r.categoryTypeSnapshot === "TRANSFER" ? t("exp.transfer") : t("exp.expense")}
                </td>
                <td className="td text-muted" data-label={t("exp.createdBy")}>{displayName(r.createdBy, locale)}</td>
                <td className="td text-end font-medium" data-label={t("exp.amount")}>{Math.round(r.amount).toLocaleString()}</td>
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
