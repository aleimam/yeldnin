import Link from "next/link";
import { requireCapability } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { monthlyReport, yearlyReport, type PerStaff } from "@/lib/xoonx/xoonx-finance-service";
import { monthKey } from "@/lib/xoonx/xoonx-finance-logic";
import { CloseMonthButton } from "./CloseMonthButton";

const egp = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
const shiftMonth = (m: string, by: number) => {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

function Kpi({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className={`text-xl font-bold ${accent ? (value >= 0 ? "text-emerald-600" : "text-red-600") : "text-ink"}`}>
        {egp(value)} <span className="text-xs font-normal text-muted">EGP</span>
      </div>
    </div>
  );
}

function Distribution({ staffPool, perStaff, t }: { staffPool: number; perStaff: PerStaff[]; t: (k: string) => string }) {
  return (
    <div className="card p-5">
      <h2 className="mb-3 font-semibold text-ink">{t("xrep.distribution")}</h2>
      <div className="mb-3 rounded-lg bg-canvas p-3">
        <div className="text-xs text-muted">{t("xrep.staffShare")}</div>
        <div className="font-bold text-ink">{egp(staffPool)} EGP</div>
      </div>
      {perStaff.length > 0 && (
        <ul className="divide-y divide-line/60 text-sm">
          {perStaff.map((s) => (
            <li key={s.id} className="flex justify-between py-1.5">
              <span className="text-ink">{s.name} <span className="text-xs text-muted">· {s.sharePct}%</span></span>
              <span className="font-medium text-ink">{egp(s.amount)} EGP</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Costs({ purchasing, local, byCategory, t }: { purchasing: number; local: number; byCategory: { name: string; amount: number }[]; t: (k: string) => string }) {
  return (
    <div className="card p-5">
      <h2 className="mb-3 font-semibold text-ink">{t("xrep.costs")}</h2>
      <div className="flex justify-between py-1 text-sm"><span className="text-muted">{t("xrep.purchasing")}</span><span className="text-ink">{egp(purchasing)} EGP</span></div>
      <div className="flex justify-between py-1 text-sm"><span className="text-muted">{t("xrep.local")}</span><span className="text-ink">{egp(local)} EGP</span></div>
      {byCategory.length > 0 && (
        <ul className="mt-2 border-t border-line/60 pt-2 text-xs text-muted">
          {byCategory.map((c) => (
            <li key={c.name} className="flex justify-between py-0.5"><span>· {c.name}</span><span>{egp(c.amount)}</span></li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function XoonxReportsPage({ searchParams }: { searchParams: Promise<{ m?: string; y?: string }> }) {
  // Reports expose net profit + partner profit shares — gated above plain VIEW.
  const access = await requireCapability("xoonx", "viewReports");
  const canClose = access.can("xoonx", "manage");
  const sp = await searchParams;
  const t = await getT();
  const now = new Date();

  if (sp.y) {
    const year = /^\d{4}$/.test(sp.y) ? sp.y : String(now.getFullYear());
    const r = await yearlyReport(year, now);
    return (
      <AppShell access={access} moduleKey="xoonx" pageTitle={t("xoonx.reports")}>
        <div className="max-w-4xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Link href={`/xoonx/reports?y=${Number(year) - 1}`} className="btn-secondary px-2 py-1"><span className="rtl-flip">‹</span></Link>
              <span className="min-w-16 text-center font-semibold text-ink">{year}</span>
              <Link href={`/xoonx/reports?y=${Number(year) + 1}`} className="btn-secondary px-2 py-1"><span className="rtl-flip">›</span></Link>
            </div>
            <Link href="/xoonx/reports" className="text-sm text-brand hover:underline">{t("xrep.monthlyView")}</Link>
          </div>
          {r.missingFx && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">{t("xrep.missingFx")}</div>}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label={t("xrep.revenue")} value={r.revenue} />
            <Kpi label={t("xrep.costs")} value={r.costs.total} />
            <Kpi label={t("xrep.gross")} value={r.grossProfit} />
            <Kpi label={t("xrep.net")} value={r.netProfit} accent />
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <Distribution staffPool={r.distribution.staffPool} perStaff={r.distribution.perStaff} t={t} />
            <Costs purchasing={r.costs.purchasing} local={r.costs.local} byCategory={r.localByCategory} t={t} />
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm" data-cards>
              <thead className="border-b border-line bg-canvas"><tr><th className="th">{t("xrep.month")}</th><th className="th text-end">{t("xrep.revenue")}</th><th className="th text-end">{t("xrep.net")}</th></tr></thead>
              <tbody className="divide-y divide-line">
                {r.byMonth.map((m) => (
                  <tr key={m.month}><td className="td" data-label={t("xrep.month")}><Link href={`/xoonx/reports?m=${m.month}`} className="text-brand hover:underline">{m.month}</Link></td><td className="td text-end" data-label={t("xrep.revenue")}>{egp(m.revenue)}</td><td className="td text-end" data-label={t("xrep.net")}>{egp(m.netProfit)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </AppShell>
    );
  }

  const month = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : monthKey(now);
  const r = await monthlyReport(month, now);
  return (
    <AppShell access={access} moduleKey="xoonx" pageTitle={t("xoonx.reports")}>
      <div className="max-w-4xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link href={`/xoonx/reports?m=${shiftMonth(month, -1)}`} className="btn-secondary px-2 py-1">‹</Link>
            <span className="min-w-24 text-center font-semibold text-ink">{month}</span>
            <Link href={`/xoonx/reports?m=${shiftMonth(month, 1)}`} className="btn-secondary px-2 py-1">›</Link>
            {r.closed && <span className="rounded bg-canvas px-2 py-0.5 text-[11px] font-medium text-muted">{t("xrep.closed")}</span>}
          </div>
          <Link href={`/xoonx/reports?y=${month.slice(0, 4)}`} className="text-sm text-brand hover:underline">{t("xrep.yearlyView")}</Link>
        </div>

        {r.missingFx && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">{t("xrep.missingFx")}</div>}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label={t("xrep.revenue")} value={r.revenue} />
          <Kpi label={t("xrep.costs")} value={r.costs.total} />
          <Kpi label={t("xrep.gross")} value={r.grossProfit} />
          <Kpi label={t("xrep.net")} value={r.netProfit} accent />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Distribution staffPool={r.distribution.staffPool} perStaff={r.distribution.perStaff} t={t} />
          <Costs purchasing={r.costs.purchasing} local={r.costs.local} byCategory={r.localByCategory} t={t} />
        </div>

        <div className="card overflow-x-auto">
          <h2 className="border-b border-line p-4 font-semibold text-ink">{t("xrep.orders")}</h2>
          <table className="w-full text-sm" data-cards>
            <thead className="border-b border-line bg-canvas">
              <tr><th className="th">{t("xrep.product")}</th><th className="th text-end">{t("xrep.selling")}</th><th className="th text-end">{t("xrep.purchasing")}</th><th className="th text-end">{t("xrep.gross")}</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {r.orders.map((o) => (
                <tr key={o.requestId}>
                  <td className="td" data-label={t("xrep.product")}><Link href={`/requests/${o.requestId}`} className="font-medium text-brand hover:underline">{o.product}</Link></td>
                  <td className="td text-end" data-label={t("xrep.selling")}>{egp(o.selling)}</td>
                  <td className="td text-end text-muted" data-label={t("xrep.purchasing")}>{egp(o.purchasing)}</td>
                  <td className="td text-end font-medium text-ink" data-label={t("xrep.gross")}>{egp(o.gross)}</td>
                </tr>
              ))}
              {r.orders.length === 0 && <tr><td className="td text-muted" colSpan={4}>{t("xrep.empty")}</td></tr>}
            </tbody>
          </table>
        </div>

        {canClose && !r.closed && r.closeable && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted">{t("xrep.closeHint")}</p>
            <CloseMonthButton month={month} />
          </div>
        )}
      </div>
    </AppShell>
  );
}
