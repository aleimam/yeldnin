import Link from "next/link";
import { cookies } from "next/headers";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { pageWindow, PER_PAGE_COOKIE } from "@/lib/pagination";
import { Paginator } from "@/components/Paginator";
import { ListSearch } from "@/components/ListSearch";
import { formatBizDate } from "@/lib/format/dates";
import { formatEgp } from "@/lib/format/money";
import { listDeliveriesPaged, deliveryStatusCounts, courierIdForUser } from "@/lib/deliveries/deliveries-service";
import { DELIVERY_STATUSES, piastresToEgp, isPrepaid, needsAttention, canSeeAllDeliveries } from "@/lib/deliveries/deliveries-logic";

/** Colour by meaning, not by prettiness: closed-good, closed-bad, slipping, moving. */
const TONE: Record<string, string> = {
  NEW: "bg-canvas text-muted",
  ASSIGNED: "bg-blue-50 text-blue-700",
  OUT_FOR_DELIVERY: "bg-indigo-50 text-indigo-700",
  DELIVERED: "bg-green-50 text-green-700",
  RESCHEDULED: "bg-amber-50 text-amber-700",
  DELAYED: "bg-amber-50 text-amber-700",
  FAILED: "bg-red-50 text-red-700",
  CANCELLED: "bg-canvas text-muted line-through",
};

export default async function DeliveriesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const access = await requireModule("couriers", "VIEW");
  const sp = await searchParams;
  const cookiePerPage = Number((await cookies()).get(PER_PAGE_COOKIE)?.value) || undefined;
  const { page, perPage, skip, take } = pageWindow({ page: sp.page, perPage: sp.perPage, cookiePerPage });

  // GOLDEN RULE (§5.1): Ops see every delivery, a courier sees ONLY their own.
  // The filter is applied in the service, server-side — never by hiding a link.
  const tier = access.user.tier;
  const ownCourierId = await courierIdForUser(access.user.id);
  const seesAll = canSeeAllDeliveries(access, tier);
  const [t, { rows, total }, counts] = await Promise.all([
    getT(),
    listDeliveriesPaged(access, tier, ownCourierId, { search: sp.q, status: sp.status, skip, take }),
    deliveryStatusCounts(access, tier, ownCourierId),
  ]);

  const tab = (key: string | undefined, label: string, count: number) => {
    const active = (sp.status ?? "") === (key ?? "");
    const qs = new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(key ? { status: key } : {}) }).toString();
    return (
      <Link
        key={key ?? "all"}
        href={`/deliveries${qs ? `?${qs}` : ""}`}
        className={`rounded px-2.5 py-1 text-xs ${active ? "bg-brand text-white" : "bg-canvas text-muted hover:text-ink"}`}
      >
        {label}
        <span className="ms-1.5 opacity-70">{count}</span>
      </Link>
    );
  };

  return (
    <AppShell access={access} moduleKey="couriers" pageTitle={t("dlv.title")}>
      <ListSearch basePath="/deliveries" value={sp.q ?? ""} placeholder={t("dlv.searchPlaceholder")} />

      <div className="mb-3 flex flex-wrap gap-1.5">
        {tab(undefined, t("dlv.all"), Object.values(counts).reduce((a, b) => a + b, 0))}
        {DELIVERY_STATUSES.filter((s) => counts[s]).map((s) => tab(s, t(`dlv.status.${s}`), counts[s]))}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full" data-cards>
          <thead className="border-b border-line bg-canvas">
            <tr>
              <th className="th">{t("dlv.order")}</th>
              <th className="th">{t("dlv.customer")}</th>
              <th className="th">{t("dlv.promised")}</th>
              {seesAll && <th className="th">{t("dlv.courier")}</th>}
              <th className="th">{t("dlv.collect")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((d) => (
              <tr key={d.id} className="hover:bg-canvas/60">
                <td className="td" data-label={t("dlv.order")}>
                  <Link href={`/deliveries/${d.id}`} className="font-medium text-brand hover:underline">
                    {d.orderNumber}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] ${TONE[d.status] ?? "bg-canvas text-muted"}`}>
                      {t(`dlv.status.${d.status}`)}
                    </span>
                    {d.reviewFlag && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800">🚩 {t("dlv.flagged")}</span>}
                    {needsAttention(d.bounceCount) && (
                      <span className="rounded bg-canvas px-1.5 py-0.5 text-[10px] text-muted">{t("dlv.attention").replace("{n}", String(d.bounceCount))}</span>
                    )}
                  </div>
                </td>
                <td className="td" data-label={t("dlv.customer")}>
                  {d.customerName}
                  {d.addressZone && <div className="text-xs text-muted">{d.addressZone}</div>}
                </td>
                <td className="td text-muted" data-label={t("dlv.promised")}>
                  {formatBizDate(d.promisedDate)}
                  {d.promisedSlot && <div className="text-xs">{d.promisedSlot}</div>}
                </td>
                {seesAll && (
                  <td className="td text-muted" data-label={t("dlv.courier")}>
                    {d.courier?.name ?? <span className="text-amber-700">{t("dlv.unassigned")}</span>}
                  </td>
                )}
                <td className="td" data-label={t("dlv.collect")}>
                  {isPrepaid(d.collectPiastres, d.paymentMethod) ? (
                    <span className="text-muted">{t("dlv.prepaid")}</span>
                  ) : (
                    formatEgp(piastresToEgp(d.collectPiastres))
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="td text-muted" colSpan={seesAll ? 5 : 4}>
                  {t("dlv.empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Paginator basePath="/deliveries" params={sp} page={page} perPage={perPage} total={total} />
    </AppShell>
  );
}
