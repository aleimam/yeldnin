import Link from "next/link";
import { cookies } from "next/headers";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT, getLocale } from "@/i18n/server";
import { listRecentEventsPaged } from "@/lib/history/history-service";
import { getWorkflow } from "@/lib/workflow/workflow-config-service";
import type { ItemStatus } from "@/lib/workflow/workflow-logic";
import { pageWindow, PER_PAGE_COOKIE } from "@/lib/pagination";
import { Paginator } from "@/components/Paginator";
import { HistorySearch } from "./HistorySearch";
import { HistoryFilters } from "./HistoryFilters";

export default async function HistoryPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const access = await requireModule("history", "VIEW");
  const sp = await searchParams;
  const cookiePerPage = Number((await cookies()).get(PER_PAGE_COOKIE)?.value) || undefined;
  const { page, perPage, skip, take } = pageWindow({ page: sp.page, perPage: sp.perPage, cookiePerPage });
  const [t, locale, { rows: events, total }, wf] = await Promise.all([
    getT(),
    getLocale(),
    listRecentEventsPaged({ search: sp.q, skip, take }),
    getWorkflow(),
  ]);
  const loc = locale === "ar" ? "ar" : "en";
  const change = (from: string | null, to: string) =>
    from && from !== to ? `${wf.label(from as ItemStatus, loc)} → ${wf.label(to as ItemStatus, loc)}` : `→ ${wf.label(to as ItemStatus, loc)}`;

  return (
    <AppShell access={access} moduleKey="history" pageTitle={t("history.title")}>
      <HistorySearch />
      <HistoryFilters basePath="/history" current={{ q: sp.q ?? "" }} />
      <div className="card overflow-x-auto">
        <table className="w-full text-sm" data-cards>
          <thead className="border-b border-line bg-canvas">
            <tr>
              <th className="th">{t("history.when")}</th>
              <th className="th">{t("history.item")}</th>
              <th className="th">{t("history.product")}</th>
              <th className="th">{t("history.change")}</th>
              <th className="th">{t("history.action")}</th>
              <th className="th">{t("history.by")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {events.map((e) => (
              <tr key={e.id} className="hover:bg-canvas/60">
                <td className="td whitespace-nowrap text-muted" data-datecol data-label={t("history.when")}>{new Date(e.createdAt).toLocaleString()}</td>
                <td className="td font-mono text-xs" data-label={t("history.item")}>
                  <Link href={`/history/items/${e.itemId}`} className="text-brand hover:underline">{e.itemUid ?? e.itemId}</Link>
                </td>
                <td className="td" data-label={t("history.product")}>{e.productName}</td>
                <td className="td" data-label={t("history.change")}>{change(e.fromStatus, e.toStatus)}</td>
                <td className="td text-muted" data-label={t("history.action")}>{e.action ?? "—"}</td>
                <td className="td text-muted" data-label={t("history.by")}>{e.byName ?? "—"}</td>
              </tr>
            ))}
            {events.length === 0 && <tr><td className="td text-muted" colSpan={6}>{t("history.empty")}</td></tr>}
          </tbody>
        </table>
      </div>
      <Paginator basePath="/history" params={sp} page={page} perPage={perPage} total={total} />
    </AppShell>
  );
}
