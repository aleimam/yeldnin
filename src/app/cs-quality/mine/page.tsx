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

  return (
    <AppShell access={access} moduleKey="cs_quality" pageTitle={t("cs.myEvaluations")} backHref="/cs-quality">
      <div className="max-w-3xl space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {an.byScope.map((s) => (
            <div key={s.scope} className="card p-5 text-center">
              <div className="text-xs font-medium uppercase tracking-wide text-muted">{t(`cs.scope.${s.scope}`)}</div>
              <div className="mt-1 text-3xl font-bold text-ink">{s.avgNormalized}%</div>
              <div className="mt-1 text-xs text-muted">{t("cs.avgScore")} · {s.count} {t("cs.evaluationsCount")}</div>
            </div>
          ))}
        </div>

        {an.byMonth.length > 0 && (
          <div className="card p-5">
            <h2 className="mb-3 font-semibold text-ink">{t("cs.byMonth")}</h2>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line"><th className="th">{t("cs.month")}</th><th className="th text-end">{t("cs.score")}</th><th className="th text-end">{t("cs.evaluationsCount")}</th></tr></thead>
              <tbody className="divide-y divide-line">{an.byMonth.map((m) => <tr key={m.month}><td className="td">{m.month}</td><td className="td text-end">{m.sum}</td><td className="td text-end text-muted">{m.count}</td></tr>)}</tbody>
            </table>
          </div>
        )}

        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-canvas">
              <tr><th className="th">{t("cs.scope")}</th><th className="th text-end">{t("cs.score")}</th><th className="th text-end">{t("cs.normalized")}</th><th className="th">{t("cs.date")}</th><th className="th"></th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((e) => (
                <tr key={e.id} className="hover:bg-canvas/60">
                  <td className="td">{t(`cs.scope.${e.scope}`)}{e.typeName ? ` · ${e.typeName}` : ""}</td>
                  <td className="td text-end">{e.total}</td>
                  <td className="td text-end">{e.normalized}%</td>
                  <td className="td text-muted">{formatBizDate(e.date)}</td>
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
