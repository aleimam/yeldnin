import Link from "next/link";
import { cookies } from "next/headers";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT, getLocale } from "@/i18n/server";
import { listTransactionsPaged, listCategories, categoryArMap, type TxSort, type TxFlagFilter } from "@/lib/expenses/expenses-service";
import { displayName } from "@/lib/users/users-logic";
import { categoryLabel } from "@/lib/expenses/category-label";
import { typeLabelKey } from "@/lib/expenses/expenses-logic";
import { formatBizDate } from "@/lib/format/dates";
import { pageWindow, PER_PAGE_COOKIE } from "@/lib/pagination";
import { Paginator } from "@/components/Paginator";
import { TransactionFilters } from "./TransactionFilters";

const FLAG_DOT: Record<string, string> = { RED: "bg-red-500", YELLOW: "bg-amber-500" };
const TYPES = new Set(["EXPENSE", "TRANSFER", "REVENUE"]);
const FLAGS = new Set(["RED", "YELLOW", "NONE", "ANY"]);
const SORTS = new Set(["accruing_desc", "accruing_asc", "registered_desc", "registered_asc", "amount_desc", "amount_asc"]);

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const access = await requireModule("expenses", "VIEW");
  const sp = await searchParams;
  const type = sp.type && TYPES.has(sp.type) ? (sp.type as "EXPENSE" | "TRANSFER" | "REVENUE") : undefined;
  const flag = sp.flag && FLAGS.has(sp.flag) ? (sp.flag as TxFlagFilter) : undefined;
  const categoryId = sp.category && Number(sp.category) > 0 ? Number(sp.category) : undefined;
  const sort = sp.sort && SORTS.has(sp.sort) ? (sp.sort as TxSort) : undefined;
  const cookiePerPage = Number((await cookies()).get(PER_PAGE_COOKIE)?.value) || undefined;
  const { page, perPage, skip, take } = pageWindow({ page: sp.page, perPage: sp.perPage, cookiePerPage });

  const [t, locale, { rows, total }, arMap, categories] = await Promise.all([
    getT(),
    getLocale(),
    listTransactionsPaged({ type, flag, categoryId, search: sp.q, sort, skip, take }),
    categoryArMap(),
    listCategories(),
  ]);
  const canCreate = access.can("expenses", "createTxn");

  return (
    <AppShell
      access={access}
      moduleKey="expenses"
      actions={canCreate ? <Link href="/expenses/transactions/new" className="btn-primary">+ {t("exp.new")}</Link> : null}
    >
      <TransactionFilters
        categories={categories.map((c) => ({ id: c.id, name: c.name, nameAr: c.nameAr }))}
        current={{ q: sp.q ?? "", type: sp.type ?? "", flag: sp.flag ?? "", category: sp.category ?? "", sort: sp.sort ?? "accruing_desc" }}
      />

      <div className="card overflow-x-auto">
        <table className="w-full" data-cards>
          <thead className="border-b border-line bg-canvas">
            <tr>
              <th className="th w-6" aria-label={t("exp.flag")}></th>
              <th className="th">{t("exp.accruingDate")}</th>
              <th className="th">{t("exp.registered")}</th>
              <th className="th">{t("exp.category")}</th>
              <th className="th">{t("exp.type")}</th>
              <th className="th">{t("exp.createdBy")}</th>
              <th className="th text-end">{t("exp.amount")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-canvas/60">
                <td className="td" data-label={t("exp.flag")}>
                  {r.flag && (
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${FLAG_DOT[r.flag] ?? "bg-muted"}`} title={t(r.flag === "RED" ? "exp.flagRed" : "exp.flagYellow")} />
                  )}
                </td>
                <td className="td whitespace-nowrap" data-datecol data-label={t("exp.accruingDate")}>
                  <Link href={`/expenses/transactions/${r.id}`} className="text-brand hover:underline">
                    {formatBizDate(r.accruingDate ?? r.createdAt)}
                  </Link>
                </td>
                <td className="td whitespace-nowrap text-muted" data-datecol data-label={t("exp.registered")}>{formatBizDate(r.createdAt)}</td>
                <td className="td" data-label={t("exp.category")}>
                  {categoryLabel(t, r.categoryNameSnapshot, locale, arMap)}
                  {r.attachments.length > 0 && <span className="ms-2 text-xs text-muted">📎{r.attachments.length}</span>}
                </td>
                <td className="td" data-label={t("exp.type")}>
                  {t(typeLabelKey(r.categoryTypeSnapshot))}
                </td>
                <td className="td text-muted" data-label={t("exp.createdBy")}>{displayName(r.createdBy, locale)}</td>
                <td className="td text-end font-medium" data-label={t("exp.amount")}>{Math.round(r.amount).toLocaleString()}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td className="td text-muted" colSpan={7}>{t("exp.empty")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Paginator basePath="/expenses/transactions" params={sp} page={page} perPage={perPage} total={total} />
    </AppShell>
  );
}
