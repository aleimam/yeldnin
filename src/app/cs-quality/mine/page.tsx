import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { formatBizDate } from "@/lib/format/dates";
import { canAccessCs } from "@/lib/cs/cs-logic";
import { listEvaluations, repAnalytics } from "@/lib/cs/cs-report-service";

export default async function CsMinePage() {
  const access = await requireUser();
  if (!canAccessCs(access)) redirect("/cs-quality");
  const me = access.user.id;
  const [t, rows, an] = await Promise.all([
    getT(),
    listEvaluations({ subjectUserId: me, status: "APPROVED", showEvaluator: false }),
    repAnalytics(me),
  ]);
  const cur = an.current.overall;
  const prev = an.previous.overall;
  const delta = cur !== null && prev !== null ? Math.round((cur - prev) * 100) / 100 : null;

  return (
    <AppShell access={access} moduleKey="cs_quality" pageTitle={t("cs.myEvaluations")} backHref="/cs-quality">
      <div className="max-w-3xl space-y-6">
        {/* This-month overall (weighted composite) + last-month comparison */}
        <div className="card p-5 text-center">
          <div className="text-xs font-medium uppercase tracking-wide text-muted">{t("cs.overallThisMonth")}</div>
          <div className="mt-1 text-3xl font-bold text-ink">{cur === null ? "—" : `${cur}%`}</div>
          <div className="mt-1 text-xs text-muted">
            {prev === null ? (
              t("cs.noLastMonth")
            ) : (
              <>
                {t("cs.lastMonth")}: {prev}%
                {delta !== null && <span className={`ms-1 font-medium ${delta >= 0 ? "text-green-600" : "text-red-600"}`}>{delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}</span>}
              </>
            )}
          </div>
        </div>

        {/* Breakdown: Calls block / Performance block / per call type */}
        <div className="card p-5">
          <h2 className="mb-3 font-semibold text-ink">{t("cs.breakdown")}</h2>
          <div className="mb-3 flex flex-wrap gap-x-8 gap-y-1 text-sm">
            <div><span className="text-muted">{t("cs.callsBlock")}: </span><span className="font-medium text-ink">{an.current.callsBlock === null ? "—" : `${an.current.callsBlock}%`}</span></div>
            <div><span className="text-muted">{t("cs.perfBlock")}: </span><span className="font-medium text-ink">{an.current.perfBlock === null ? "—" : `${an.current.perfBlock}%`}</span></div>
          </div>
          <table className="w-full text-sm" data-cards>
            <thead><tr className="border-b border-line"><th className="th">{t("cs.callType")}</th><th className="th text-end">{t("cs.weight")}</th><th className="th text-end">{t("cs.avgScore")}</th></tr></thead>
            <tbody className="divide-y divide-line">
              {an.current.byType.map((ty) => (
                <tr key={ty.name}>
                  <td className="td" data-label={t("cs.callType")}>{ty.name}</td>
                  <td className="td text-end text-muted" data-label={t("cs.weight")}>{ty.weight}%</td>
                  <td className="td text-end" data-label={t("cs.avgScore")}>{ty.avg === null ? "—" : `${ty.avg}%`}</td>
                </tr>
              ))}
              {an.current.byType.length === 0 && <tr><td className="td text-muted" colSpan={3}>—</td></tr>}
            </tbody>
          </table>
        </div>

        {an.byMonth.length > 0 && (
          <div className="card p-5">
            <h2 className="mb-3 font-semibold text-ink">{t("cs.byMonth")}</h2>
            <table className="w-full text-sm" data-cards>
              <thead><tr className="border-b border-line"><th className="th">{t("cs.month")}</th><th className="th text-end">{t("cs.overallAvg")}</th><th className="th text-end">{t("cs.evaluationsCount")}</th></tr></thead>
              <tbody className="divide-y divide-line">{an.byMonth.map((m) => <tr key={m.month}><td className="td" data-label={t("cs.month")}>{m.month}</td><td className="td text-end" data-label={t("cs.overallAvg")}>{m.overall === null ? "—" : `${m.overall}%`}</td><td className="td text-end text-muted" data-label={t("cs.evaluationsCount")}>{m.count}</td></tr>)}</tbody>
            </table>
          </div>
        )}

        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm" data-cards>
            <thead className="border-b border-line bg-canvas">
              <tr><th className="th">{t("cs.scope")}</th><th className="th text-end">{t("cs.score")}</th><th className="th text-end">{t("cs.normalized")}</th><th className="th">{t("cs.date")}</th><th className="th"></th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((e) => (
                <tr key={e.id} className="hover:bg-canvas/60">
                  <td className="td" data-label={t("cs.scope")}>{t(`cs.scope.${e.scope}`)}{e.typeName ? ` · ${e.typeName}` : ""}</td>
                  <td className="td text-end" data-label={t("cs.score")}>{e.total}</td>
                  <td className="td text-end" data-label={t("cs.normalized")}>{e.normalized}%</td>
                  <td className="td text-muted" data-label={t("cs.date")}>{formatBizDate(e.date)}</td>
                  <td className="td text-end"><Link href={`/cs-quality/evaluations/${e.id}`} className="text-brand hover:underline">{t("cs.viewEval")}</Link></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td className="td text-muted" colSpan={5}>{t("cs.noEvaluations")}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
