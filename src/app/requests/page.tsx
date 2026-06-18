import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { requestScopes, primaryRequestModule } from "@/lib/requests/request-logic";
import { listRequests } from "@/lib/requests/request-service";
import { itemStatusSummary, categoryCountsByRequest } from "@/lib/items/items-service";
import { ITEM_BUCKETS, categoryLabels, emptyCategoryCounts } from "@/lib/items/items-logic";
import { moduleContextScopes } from "@/lib/module-context";
import { worstSlaByRequest } from "@/lib/sla/sla-service";
import { slaRowClass } from "@/lib/sla/sla-logic";
import { SlaBadge } from "@/components/SlaBadge";
import { ItemCounts } from "@/components/ItemCounts";

export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const access = await requireUser();
  const visible = requestScopes(access, "VIEW");
  if (!visible.length) redirect("/");
  const sp = await searchParams;
  const ctx = typeof sp.m === "string" && access.canModule(sp.m, "VIEW") ? sp.m : null;
  const moduleKey = ctx ?? primaryRequestModule(access);
  const ctxScopes = ctx ? moduleContextScopes(ctx) : null;
  const scopes = ctxScopes ? visible.filter((s) => ctxScopes.includes(s)) : visible;
  const canManage = requestScopes(access, "OPERATE").length > 0;
  const [t, rows, summary] = await Promise.all([getT(), listRequests({ scopes }), itemStatusSummary(scopes)]);
  const [slaByReq, counts] = await Promise.all([
    worstSlaByRequest(
      rows.map((r) => r.id),
      new Map(rows.map((r) => [r.id, r.deliveredAt])),
    ),
    categoryCountsByRequest(rows.map((r) => r.id)),
  ]);
  const labels = categoryLabels(t);
  let slaRisk = 0;
  let slaDelayed = 0;
  for (const s of slaByReq.values()) {
    if (s === "RISK") slaRisk++;
    else if (s === "DELAYED") slaDelayed++;
  }

  return (
    <AppShell
      access={access}
      moduleKey={moduleKey}
      pageTitle={t("requests.title")}
      actions={canManage ? <Link href="/requests/new" className="btn-primary">+ {t("requests.new")}</Link> : null}
    >
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

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-line bg-canvas">
            <tr>
              <th className="th">{t("requests.uid")}</th>
              <th className="th">{t("requests.type")}</th>
              <th className="th">{t("requests.scope")}</th>
              <th className="th">{t("requests.customer")}</th>
              <th className="th">{t("requests.items")}</th>
              <th className="th">SLA</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => {
              const st = slaByReq.get(r.id);
              return (
                <tr key={r.id} className={`hover:bg-canvas/60 ${slaRowClass(st)}`}>
                  <td className="td font-mono text-xs text-muted">
                    <Link href={`/requests/${r.id}`} className="text-brand hover:underline">{r.uid ?? r.id}</Link>
                  </td>
                  <td className="td">{t(`reqtype.${r.type}`)}</td>
                  <td className="td text-muted">{t(`scope.${r.scope}`)}</td>
                  <td className="td text-muted">{r.customer?.name ?? "—"}</td>
                  <td className="td"><ItemCounts counts={counts.get(r.id) ?? emptyCategoryCounts()} labels={labels} /></td>
                  <td className="td">{st ? <SlaBadge status={st} label={t(`sla.${st.toLowerCase()}`)} /> : <span className="text-muted">—</span>}</td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td className="td text-muted" colSpan={6}>{t("requests.empty")}</td></tr>}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
