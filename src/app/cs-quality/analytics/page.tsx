import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT, getLocale } from "@/i18n/server";
import { canManageCs, expectedBonus } from "@/lib/cs/cs-logic";
import { allRepsAnalytics, evaluatorActivity, monthlyScoreMatrix, monthsWindow } from "@/lib/cs/cs-report-service";
import { repBonusMap, getBonusTiers } from "@/lib/cs/cs-bonus-service";

const WINDOW = 6; // months shown across the activity grid + the score record

export default async function CsAnalyticsPage({ searchParams }: { searchParams: Promise<{ back?: string }> }) {
  const access = await requireUser();
  if (!canManageCs(access)) redirect("/cs-quality");
  const sp = await searchParams;
  const back = Math.max(0, Number(sp.back) || 0);
  const now = new Date();

  const t = await getT();
  const locale = await getLocale();
  const activityMonths = monthsWindow(now, WINDOW, 0); // always the latest 6 months
  const scoreMonths = monthsWindow(now, WINDOW, back); // record is pageable to any past period
  const [reps, bonuses, tiers, evaluators, scoreRows] = await Promise.all([
    allRepsAnalytics(now),
    repBonusMap(),
    getBonusTiers(),
    evaluatorActivity(activityMonths),
    access.isAdmin ? monthlyScoreMatrix(scoreMonths) : Promise.resolve([]),
  ]);

  const monthLabel = (mk: string) => {
    const [y, m] = mk.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(locale === "ar" ? "ar" : "en", { month: "short", year: "2-digit", timeZone: "UTC" });
  };

  return (
    <AppShell access={access} moduleKey="cs_quality" pageTitle={t("cs.analytics")} backHref="/cs-quality">
      <div className="space-y-8">
        {/* Sales-rep scores (subjects) — current/last month leaderboard */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{t("cs.repScores")}</h2>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm" data-cards>
              <thead className="border-b border-line bg-canvas">
                <tr>
                  <th className="th">{t("cs.salesRep")}</th>
                  <th className="th text-end">{t("cs.evaluationsCount")}</th>
                  <th className="th text-end">{t("cs.thisMonth")}</th>
                  <th className="th text-end">{t("cs.lastMonth")}</th>
                  <th className="th text-end">{t("cs.expectedBonus")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {reps.map((r) => (
                  <tr key={r.id} className="hover:bg-canvas/60">
                    <td className="td" data-label={t("cs.salesRep")}>{r.name}</td>
                    <td className="td text-end text-muted" data-label={t("cs.evaluationsCount")}>{r.count}</td>
                    <td className="td text-end font-medium" data-label={t("cs.thisMonth")}>{r.current === null ? "—" : `${r.current}%`}</td>
                    <td className="td text-end text-muted" data-label={t("cs.lastMonth")}>{r.previous === null ? "—" : `${r.previous}%`}</td>
                    <td className="td text-end" data-label={t("cs.expectedBonus")}>{expectedBonus(r.current, bonuses.get(r.id) ?? 0, tiers).toLocaleString()} {t("cs.egp")}</td>
                  </tr>
                ))}
                {reps.length === 0 && <tr><td className="td text-muted" colSpan={5}>{t("cs.noEvaluations")}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        {/* Monthly score record — every rep's overall score by month (admin only, pageable) */}
        {access.isAdmin && (
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t("cs.scoreRecord")}</h2>
              <div className="flex items-center gap-2 text-sm">
                <Link href={`/cs-quality/analytics?back=${back + WINDOW}`} className="btn-secondary px-2 py-1"><span className="rtl-flip">‹</span></Link>
                <span className="text-muted">{monthLabel(scoreMonths[scoreMonths.length - 1])} – {monthLabel(scoreMonths[0])}</span>
                <Link href={`/cs-quality/analytics?back=${Math.max(0, back - WINDOW)}`} className={`btn-secondary px-2 py-1 ${back === 0 ? "pointer-events-none opacity-40" : ""}`}><span className="rtl-flip">›</span></Link>
              </div>
            </div>
            <div className="card overflow-x-auto">
              <table className="w-full text-sm" data-cards>
                <thead className="border-b border-line bg-canvas">
                  <tr>
                    <th className="th">{t("cs.salesRep")}</th>
                    {scoreMonths.map((mk) => <th key={mk} className="th text-end">{monthLabel(mk)}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {scoreRows.map((r) => (
                    <tr key={r.id} className="hover:bg-canvas/60">
                      <td className="td" data-label={t("cs.salesRep")}>{r.name}</td>
                      {r.scores.map((s, i) => (
                        <td key={scoreMonths[i]} className="td text-end" data-label={monthLabel(scoreMonths[i])}>{s === null ? "—" : `${s}%`}</td>
                      ))}
                    </tr>
                  ))}
                  {scoreRows.length === 0 && <tr><td className="td text-muted" colSpan={WINDOW + 1}>{t("cs.noEvaluations")}</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Evaluator activity — last 6 months, one column per month:
            "approved of submitted | avg% · comments" */}
        <section>
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">{t("cs.evaluatorActivity")}</h2>
          <p className="mb-3 text-xs text-muted">{t("cs.activityLegend")}</p>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm" data-cards>
              <thead className="border-b border-line bg-canvas">
                <tr>
                  <th className="th">{t("cs.evaluator")}</th>
                  {activityMonths.map((mk) => <th key={mk} className="th text-end">{monthLabel(mk)}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {evaluators.map((e) => (
                  <tr key={e.id} className="hover:bg-canvas/60">
                    <td className="td" data-label={t("cs.evaluator")}>{e.name}</td>
                    {e.months.map((m, i) => (
                      <td key={activityMonths[i]} className="td text-end" data-label={monthLabel(activityMonths[i])}>
                        {m.submitted === 0 ? "—" : (
                          <span className="whitespace-nowrap">{m.approved} {t("cs.actOf")} {m.submitted} <span className="text-muted">| {m.avgScore === null ? "—" : `${m.avgScore}%`} · {m.comments}</span></span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
                {evaluators.length === 0 && <tr><td className="td text-muted" colSpan={WINDOW + 1}>{t("cs.noEvaluations")}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
