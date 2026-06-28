import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listTripsPaged } from "@/lib/trips/trip-service";
import { categoryCountsByCurrentContainer, inboundPendingByDestination } from "@/lib/items/items-service";
import { categoryLabels, emptyCategoryCounts } from "@/lib/items/items-logic";
import { worstSlaByCurrentContainer } from "@/lib/sla/sla-service";
import { slaRowClass } from "@/lib/sla/sla-logic";
import { ItemCounts } from "@/components/ItemCounts";
import { TripApproveButtons } from "./TripApproveButtons";
import { TripsFilters } from "./TripsFilters";
import { formatBizDate } from "@/lib/format/dates";
import { pageWindow, PER_PAGE_COOKIE } from "@/lib/pagination";
import { Paginator } from "@/components/Paginator";

export default async function TripsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const access = await requireUser();
  if (!access.canModule("logistics", "VIEW") && !access.canModule("operations", "VIEW")) redirect("/");
  if (access.hidesTripTraveler) redirect("/");
  const canManage = access.can("logistics", "operate");
  const sp = await searchParams;
  const cookiePerPage = Number((await cookies()).get(PER_PAGE_COOKIE)?.value) || undefined;
  const { page, perPage, skip, take } = pageWindow({ page: sp.page, perPage: sp.perPage, cookiePerPage });
  const [t, { rows, total }] = await Promise.all([
    getT(),
    listTripsPaged({ search: sp.q, status: sp.status, sort: sp.sort, skip, take }),
  ]);
  const ids = rows.map((r) => r.id);
  const [inv, inbound, sla] = await Promise.all([
    categoryCountsByCurrentContainer("TRIP", ids),
    inboundPendingByDestination("TRIP", ids),
    worstSlaByCurrentContainer("TRIP", ids),
  ]);
  const labels = categoryLabels(t);
  return (
    <AppShell
      access={access}
      moduleKey="logistics"
      pageTitle={t("trip.title")}
      actions={canManage ? <Link href="/trips/new" className="btn-primary">+ {t("trip.new")}</Link> : null}
    >
      <TripsFilters basePath="/trips" current={{ q: sp.q ?? "", status: sp.status ?? "", sort: sp.sort ?? "" }} />
      <div className="card overflow-x-auto">
        <table className="w-full" data-cards>
          <thead className="border-b border-line bg-canvas">
            <tr>
              <th className="th">{t("trip.traveler")}</th>
              <th className="th">{t("trip.country")}</th>
              <th className="th">{t("trip.lastReceiving")}</th>
              <th className="th">{t("trip.inventory")}</th>
              <th className="th text-end">{t("trip.inbound")}</th>
              <th className="th">{t("trip.status")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((tr) => {
              const pending = inbound.get(tr.id)?.count ?? 0;
              return (
              <tr key={tr.id} className={`hover:bg-canvas/60 ${slaRowClass(sla.get(tr.id))}`}>
                <td className="td" data-label={t("trip.traveler")}><Link href={`/trips/${tr.id}`} className="text-brand hover:underline">{tr.traveler.name}</Link></td>
                <td className="td text-muted" data-label={t("trip.country")}>{tr.country}</td>
                <td className="td text-muted" data-datecol data-label={t("trip.lastReceiving")}>{formatBizDate(tr.lastReceivingDate)}</td>
                <td className="td" data-label={t("trip.inventory")}><ItemCounts counts={inv.get(tr.id) ?? emptyCategoryCounts()} labels={labels} /></td>
                <td className="td text-end text-muted" data-label={t("trip.inbound")}>{pending || "—"}</td>
                <td className="td" data-label={t("trip.status")}>
                  {tr.status === "NEW" && access.isAdmin
                    ? <TripApproveButtons id={tr.id} />
                    : t(`tripstatus.${tr.status}`)}
                </td>
              </tr>
              );
            })}
            {rows.length === 0 && <tr><td className="td text-muted" colSpan={6}>{t("trip.empty")}</td></tr>}
          </tbody>
        </table>
      </div>
      <Paginator basePath="/trips" params={sp} page={page} perPage={perPage} total={total} />
    </AppShell>
  );
}
