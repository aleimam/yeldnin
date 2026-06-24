import Link from "next/link";
import { cookies } from "next/headers";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { formatBizDate } from "@/lib/format/dates";
import { listTransfersPaged } from "@/lib/transfers/transfer-service";
import { pageWindow, PER_PAGE_COOKIE } from "@/lib/pagination";
import { Paginator } from "@/components/Paginator";
import { ListSearch } from "@/components/ListSearch";

export default async function TransfersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const access = await requireModule("logistics", "VIEW");
  const sp = await searchParams;
  const cookiePerPage = Number((await cookies()).get(PER_PAGE_COOKIE)?.value) || undefined;
  const { page, perPage, skip, take } = pageWindow({ page: sp.page, perPage: sp.perPage, cookiePerPage });
  const [t, { rows, total }] = await Promise.all([getT(), listTransfersPaged({ search: sp.q, skip, take })]);
  const canCreate = access.isAdmin || access.can("logistics", "operate");

  return (
    <AppShell access={access} moduleKey="logistics" pageTitle={t("transfers.title")} backHref="/logistics">
      <div className="space-y-4">
        {canCreate && (
          <div className="flex justify-end">
            <Link href="/transfers/new" className="btn-primary px-3 py-1.5 text-sm">+ {t("transfers.new")}</Link>
          </div>
        )}
        <ListSearch basePath="/transfers" value={sp.q ?? ""} placeholder={t("transfers.searchPlaceholder")} />
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm" data-cards>
            <thead className="border-b border-line bg-canvas">
              <tr>
                <th className="th">{t("transfers.uid")}</th>
                <th className="th">{t("transfers.from")}</th>
                <th className="th">{t("transfers.to")}</th>
                <th className="th">{t("transfers.country")}</th>
                <th className="th">{t("transfers.status")}</th>
                <th className="th">{t("transfers.date")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-canvas/60">
                  <td className="td font-mono text-xs text-muted" data-label={t("transfers.uid")}>
                    <Link href={`/transfers/${r.id}`} className="text-brand hover:underline">{r.uid ?? r.id}</Link>
                  </td>
                  <td className="td" data-label={t("transfers.from")}>{r.fromName ?? `${r.fromType} #${r.fromId}`}</td>
                  <td className="td" data-label={t("transfers.to")}>{r.toName ?? `${r.toType} #${r.toId}`}</td>
                  <td className="td text-muted" data-label={t("transfers.country")}>{r.country}</td>
                  <td className="td" data-label={t("transfers.status")}>{t(`transferstatus.${r.status}`)}</td>
                  <td className="td text-muted" data-label={t("transfers.date")}>{formatBizDate(r.createdAt)}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td className="td text-muted" colSpan={6}>{t("transfers.empty")}</td></tr>}
            </tbody>
          </table>
        </div>
        <Paginator basePath="/transfers" params={sp} page={page} perPage={perPage} total={total} />
      </div>
    </AppShell>
  );
}
