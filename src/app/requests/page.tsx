import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { requestScopes, primaryRequestModule } from "@/lib/requests/request-logic";
import { listRequestsPaged, listRequestSlaInputs, requestCreatorNames, countPendingRequests, type RequestSortKey } from "@/lib/requests/request-service";
import { monthlyReport } from "@/lib/xoonx/xoonx-finance-service";
import { monthKey } from "@/lib/xoonx/xoonx-finance-logic";
import { formatEgp } from "@/lib/format/money";
import { itemStatusSummary, categoryCountsByRequest } from "@/lib/items/items-service";
import { ITEM_BUCKETS, categoryLabels, emptyCategoryCounts } from "@/lib/items/items-logic";
import { moduleContextScopes } from "@/lib/module-context";
import { worstSlaByRequest } from "@/lib/sla/sla-service";
import { slaRowClass } from "@/lib/sla/sla-logic";
import { SlaBadge } from "@/components/SlaBadge";
import { ItemCounts } from "@/components/ItemCounts";
import { CountPopover } from "@/components/CountPopover";
import { pageWindow, PER_PAGE_COOKIE } from "@/lib/pagination";
import { Paginator } from "@/components/Paginator";
import { RequestsFilters } from "./RequestsFilters";
import { RequestsTabs } from "./RequestsTabs";
import { RequestStatusBadge } from "./RequestStatusBadge";

const SORT_KEYS = ["created", "customer", "type", "status", "scope"] as const;

export default async function RequestsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const access = await requireUser();
  const visible = requestScopes(access, "VIEW");
  if (!visible.length) redirect("/");
  const sp = await searchParams;
  const ctx = typeof sp.m === "string" && access.canModule(sp.m, "VIEW") ? sp.m : null;
  const moduleKey = ctx ?? primaryRequestModule(access);
  const ctxScopes = ctx ? moduleContextScopes(ctx) : null;
  const scopes = ctxScopes ? visible.filter((s) => ctxScopes.includes(s)) : visible;
  const canManage = requestScopes(access, "OPERATE").length > 0;
  const cookiePerPage = Number((await cookies()).get(PER_PAGE_COOKIE)?.value) || undefined;
  const { page, perPage, skip, take } = pageWindow({ page: sp.page, perPage: sp.perPage, cookiePerPage });
  const sort = (SORT_KEYS as readonly string[]).includes(sp.sort ?? "") ? (sp.sort as RequestSortKey) : "created";
  const dir = sp.dir === "asc" ? "asc" : "desc";

  // Landing cues: approvers get a pending-EGV banner; XOONX report viewers get a
  // this-month revenue/net strip (same gate as the Reports page). Both are
  // fetched only when the viewer actually qualifies.
  const canApprove = access.can("order_requests", "approve") && scopes.includes("EGV");
  const showXoonxSnap = moduleKey === "xoonx" && access.can("xoonx", "viewReports");
  const now = new Date();
  const month = monthKey(now);

  const [t, { rows, total }, summary, slaInputs, pendingCount, xoonxSnap] = await Promise.all([
    getT(),
    listRequestsPaged({ scopes, search: sp.q, type: sp.type, status: sp.status, onlyUnfulfilled: sp.all !== "1", sort, dir, skip, take }),
    itemStatusSummary(scopes),
    listRequestSlaInputs({ scopes }),
    canApprove ? countPendingRequests(["EGV"]) : Promise.resolve(0),
    showXoonxSnap ? monthlyReport(month, now) : Promise.resolve(null),
  ]);
  const [slaByReq, counts, creators] = await Promise.all([
    worstSlaByRequest(slaInputs.map((r) => r.id), new Map(slaInputs.map((r) => [r.id, r.deliveredAt]))),
    categoryCountsByRequest(rows.map((r) => r.id)),
    requestCreatorNames(rows.map((r) => r.createdById)),
  ]);
  const labels = categoryLabels(t);
  let slaRisk = 0;
  let slaDelayed = 0;
  for (const s of slaByReq.values()) {
    if (s === "RISK") slaRisk++;
    else if (s === "DELAYED") slaDelayed++;
  }

  const sortHref = (key: string) => {
    const p = new URLSearchParams();
    for (const k of ["q", "type", "status", "all", "m", "perPage"] as const) {
      const v = sp[k];
      if (v) p.set(k, v);
    }
    p.set("sort", key);
    p.set("dir", sort === key && dir === "desc" ? "asc" : "desc");
    return `/requests?${p.toString()}`;
  };
  const arrow = (key: string) => (sort === key ? (dir === "desc" ? " ↓" : " ↑") : "");

  return (
    <AppShell
      access={access}
      moduleKey={moduleKey}
      pageTitle={t("requests.title")}
      actions={canManage ? <Link href="/requests/new" className="btn-primary">+ {t("requests.new")}</Link> : null}
    >
      <RequestsTabs active="list" m={ctx ?? ""} t={t} />

      {pendingCount > 0 && (
        <Link
          href={`/requests?status=PENDING${ctx ? `&m=${ctx}` : ""}`}
          className="alert alert-warning mb-6 flex items-center justify-between gap-3 hover:opacity-90"
        >
          <span>⏳ {t("rdash.awaitApproval", { count: pendingCount })}</span>
          <span className="font-semibold">{t("rdash.review")}</span>
        </Link>
      )}

      {xoonxSnap && (
        <div className="card mb-6 flex flex-wrap items-center justify-between gap-x-8 gap-y-2 p-4">
          <div className="flex flex-wrap items-baseline gap-x-8 gap-y-1 text-sm">
            <span className="text-xs text-muted">{t("rdash.thisMonth")} · {month}</span>
            <div><span className="text-muted">{t("xrep.revenue")}: </span><span className="font-bold text-ink">{formatEgp(xoonxSnap.revenue)} EGP</span></div>
            <div><span className="text-muted">{t("xrep.net")}: </span><span className={`font-bold ${xoonxSnap.netProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatEgp(xoonxSnap.netProfit)} EGP</span></div>
          </div>
          <Link href="/xoonx/reports" className="text-sm font-medium text-brand hover:underline">{t("xoonx.reports")}</Link>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {ITEM_BUCKETS.map((b) => (
          <div key={b} className="card p-3 text-center">
            <div className={`text-2xl font-bold ${b === "problems" && summary[b] > 0 ? "text-red-600" : "text-ink"}`}>{summary[b]}</div>
            <div className="text-xs text-muted">{t(`rdash.${b}`)}</div>
          </div>
        ))}
      </div>

      {(slaRisk > 0 || slaDelayed > 0) && (
        <div className="mb-6 flex gap-3">
          <div className="card flex-1 p-3 text-center"><div className="text-2xl font-bold text-amber-600">{slaRisk}</div><div className="text-xs text-muted">{t("sla.risk")}</div></div>
          <div className="card flex-1 p-3 text-center"><div className="text-2xl font-bold text-red-600">{slaDelayed}</div><div className="text-xs text-muted">{t("sla.delayed")}</div></div>
        </div>
      )}

      <RequestsFilters basePath="/requests" current={{ q: sp.q ?? "", type: sp.type ?? "", status: sp.status ?? "", m: ctx ?? "", all: sp.all === "1" ? "1" : "" }} />

      <div className="card overflow-x-auto">
        <table className="w-full" data-cards>
          <thead className="border-b border-line bg-canvas">
            <tr>
              <th className="th"><Link href={sortHref("customer")} className="hover:text-brand">{t("requests.customer")}{arrow("customer")}</Link></th>
              <th className="th"><Link href={sortHref("type")} className="hover:text-brand">{t("requests.type")}{arrow("type")}</Link></th>
              <th className="th"><Link href={sortHref("status")} className="hover:text-brand">{t("req.status")}{arrow("status")}</Link></th>
              <th className="th"><Link href={sortHref("scope")} className="hover:text-brand">{t("requests.scope")}{arrow("scope")}</Link></th>
              <th className="th">{t("requests.createdBy")}</th>
              <th className="th">{t("requests.items")}</th>
              <th className="th">SLA</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => {
              const st = slaByReq.get(r.id);
              const lineItems = r.lines.map((l) => ({ name: l.product.name, count: l.count }));
              return (
                <tr key={r.id} className={`hover:bg-canvas/60 ${slaRowClass(st)}`}>
                  <td className="td" data-label={t("requests.customer")}>
                    <Link href={`/requests/${r.id}`} className="font-medium text-brand hover:underline">{r.customer?.name ?? t(`reqtype.${r.type}`)}</Link>
                  </td>
                  <td className="td" data-label={t("requests.type")}>{t(`reqtype.${r.type}`)}</td>
                  <td className="td" data-label={t("req.status")}><RequestStatusBadge status={r.status} label={t(`reqstatus.${r.status}`)} /></td>
                  <td className="td text-muted" data-label={t("requests.scope")}>{t(`scope.${r.scope}`)}</td>
                  <td className="td text-muted" data-label={t("requests.createdBy")}>{r.createdById ? creators.get(r.createdById) ?? "—" : "—"}</td>
                  <td className="td" data-label={t("requests.items")}><CountPopover trigger={<ItemCounts counts={counts.get(r.id) ?? emptyCategoryCounts()} labels={labels} />} items={lineItems} empty={t("requests.empty")} /></td>
                  <td className="td" data-label="SLA">{st ? <SlaBadge status={st} label={t(`sla.${st.toLowerCase()}`)} /> : <span className="text-muted">—</span>}</td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td className="td text-muted" colSpan={7}>{t("requests.empty")}</td></tr>}
          </tbody>
        </table>
      </div>
      <Paginator basePath="/requests" params={sp} page={page} perPage={perPage} total={total} />
    </AppShell>
  );
}
