import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listTravelersWithStatsPaged } from "@/lib/travelers/travelers-service";
import { worstSlaByCurrentContainer } from "@/lib/sla/sla-service";
import { slaRowClass, SLA_RANK, type SlaStatus } from "@/lib/sla/sla-logic";
import { formatBizDate } from "@/lib/format/dates";
import { pageWindow, PER_PAGE_COOKIE } from "@/lib/pagination";
import { Paginator } from "@/components/Paginator";
import { ListSearch } from "@/components/ListSearch";

export default async function TravelersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const access = await requireModule("logistics", "VIEW");
  if (access.hidesTripTraveler) redirect("/");
  const canManage = access.can("logistics", "operate");
  const sp = await searchParams;
  const cookiePerPage = Number((await cookies()).get(PER_PAGE_COOKIE)?.value) || undefined;
  const { page, perPage, skip, take } = pageWindow({ page: sp.page, perPage: sp.perPage, cookiePerPage });
  const [t, { rows, total }] = await Promise.all([getT(), listTravelersWithStatsPaged({ search: sp.q, skip, take })]);
  const slaByTrip = await worstSlaByCurrentContainer("TRIP", rows.flatMap((r) => r.stats.tripIds));
  const travelerSla = (tripIds: number[]): SlaStatus | undefined => {
    let worst: SlaStatus | undefined;
    for (const id of tripIds) {
      const s = slaByTrip.get(id);
      if (s && (!worst || SLA_RANK[s] > SLA_RANK[worst])) worst = s;
    }
    return worst;
  };
  return (
    <AppShell
      access={access}
      moduleKey="logistics"
      pageTitle={t("travelers.title")}
      actions={canManage ? <Link href="/travelers/new" className="btn-primary">+ {t("travelers.new")}</Link> : null}
    >
      <ListSearch basePath="/travelers" value={sp.q ?? ""} placeholder={t("travelers.searchPlaceholder")} />
      <div className="card overflow-x-auto">
        <table className="w-full" data-cards>
          <thead className="border-b border-line bg-canvas">
            <tr>
              <th className="th">{t("travelers.name")}</th>
              <th className="th">{t("travelers.contact")}</th>
              <th className="th">{t("travelers.nextTrip")}</th>
              <th className="th text-end">{t("requests.items")}</th>
              <th className="th text-end">{t("travelers.trips")}</th>
              <th className="th">{t("travelers.maleSupport")}</th>
              <th className="th">{t("travelers.status")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((tr) => (
              <tr key={tr.id} className={`hover:bg-canvas/60 ${slaRowClass(travelerSla(tr.stats.tripIds))}`}>
                <td className="td" data-label={t("travelers.name")}>
                  <Link href={`/travelers/${tr.id}`} className="font-medium text-brand hover:underline">{tr.name}</Link>
                  {tr._count.photos > 0 && <span className="ms-2 text-xs text-muted">📎{tr._count.photos}</span>}
                </td>
                <td className="td text-muted" data-label={t("travelers.contact")}>{tr.contact ?? "—"}</td>
                <td className="td text-muted" data-datecol data-label={t("travelers.nextTrip")}>{tr.stats.nextTrip ? formatBizDate(tr.stats.nextTrip) : "—"}</td>
                <td className="td text-end text-muted" data-label={t("requests.items")}>{tr.stats.itemCount || "—"}</td>
                <td className="td text-end text-muted" data-label={t("travelers.trips")}>{tr.stats.tripCount || "—"}</td>
                <td className="td" data-label={t("travelers.maleSupport")}>{tr.carriesMaleSupport ? <span className="text-green-600">✓</span> : <span className="text-muted">—</span>}</td>
                <td className="td" data-label={t("travelers.status")}>
                  {tr.blacklisted && <span className="me-1 rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-700">{t("travelers.blacklisted")}</span>}
                  {!tr.active && <span className="rounded bg-canvas px-1.5 py-0.5 text-[10px] text-muted">{t("travelers.inactive")}</span>}
                  {tr.active && !tr.blacklisted && <span className="text-green-600">●</span>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="td text-muted" colSpan={7}>{t("travelers.empty")}</td></tr>}
          </tbody>
        </table>
      </div>
      <Paginator basePath="/travelers" params={sp} page={page} perPage={perPage} total={total} />
    </AppShell>
  );
}
