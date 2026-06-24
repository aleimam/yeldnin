import Link from "next/link";
import { cookies } from "next/headers";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listHubsPaged } from "@/lib/hubs/hubs-service";
import { categoryCountsByCurrentContainer, inboundPendingByDestination } from "@/lib/items/items-service";
import { categoryLabels, emptyCategoryCounts } from "@/lib/items/items-logic";
import { worstSlaByCurrentContainer } from "@/lib/sla/sla-service";
import { slaRowClass } from "@/lib/sla/sla-logic";
import { ItemCounts } from "@/components/ItemCounts";
import { pageWindow, PER_PAGE_COOKIE } from "@/lib/pagination";
import { Paginator } from "@/components/Paginator";
import { ListSearch } from "@/components/ListSearch";

export default async function HubsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const access = await requireModule("logistics", "VIEW");
  const canManage = access.can("logistics", "operate");
  const sp = await searchParams;
  const cookiePerPage = Number((await cookies()).get(PER_PAGE_COOKIE)?.value) || undefined;
  const { page, perPage, skip, take } = pageWindow({ page: sp.page, perPage: sp.perPage, cookiePerPage });
  const [t, { rows, total }] = await Promise.all([getT(), listHubsPaged({ search: sp.q, skip, take })]);
  const ids = rows.map((r) => r.id);
  const [inv, inbound, sla] = await Promise.all([
    categoryCountsByCurrentContainer("HUB", ids),
    inboundPendingByDestination("HUB", ids),
    worstSlaByCurrentContainer("HUB", ids),
  ]);
  const labels = categoryLabels(t);
  return (
    <AppShell
      access={access}
      moduleKey="logistics"
      pageTitle={t("hubs.title")}
      actions={canManage ? <Link href="/hubs/new" className="btn-primary">+ {t("hubs.new")}</Link> : null}
    >
      <ListSearch basePath="/hubs" value={sp.q ?? ""} placeholder={t("hubs.searchPlaceholder")} />
      <div className="card overflow-x-auto">
        <table className="w-full" data-cards>
          <thead className="border-b border-line bg-canvas">
            <tr>
              <th className="th">{t("hubs.uid")}</th>
              <th className="th">{t("hubs.name")}</th>
              <th className="th">{t("hubs.country")}</th>
              <th className="th">{t("trip.inventory")}</th>
              <th className="th text-end">{t("trip.inbound")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((h) => {
              const pending = inbound.get(h.id)?.count ?? 0;
              return (
              <tr key={h.id} className={`hover:bg-canvas/60 ${slaRowClass(sla.get(h.id))}`}>
                <td className="td font-mono text-xs text-muted" data-label={t("hubs.uid")}>{h.uid ?? "—"}</td>
                <td className="td" data-label={t("hubs.name")}>
                  <Link href={`/hubs/${h.id}`} className="font-medium text-brand hover:underline">{h.name}</Link>
                  {h._count.photos > 0 && <span className="ms-2 text-xs text-muted">📎{h._count.photos}</span>}
                  {!h.active && <span className="ms-2 rounded bg-canvas px-1.5 py-0.5 text-[10px] text-muted">{t("hubs.inactive")}</span>}
                </td>
                <td className="td text-muted" data-label={t("hubs.country")}>{h.country}</td>
                <td className="td" data-label={t("trip.inventory")}><ItemCounts counts={inv.get(h.id) ?? emptyCategoryCounts()} labels={labels} /></td>
                <td className="td text-end text-muted" data-label={t("trip.inbound")}>{pending || "—"}</td>
              </tr>
              );
            })}
            {rows.length === 0 && <tr><td className="td text-muted" colSpan={5}>{t("hubs.empty")}</td></tr>}
          </tbody>
        </table>
      </div>
      <Paginator basePath="/hubs" params={sp} page={page} perPage={perPage} total={total} />
    </AppShell>
  );
}
