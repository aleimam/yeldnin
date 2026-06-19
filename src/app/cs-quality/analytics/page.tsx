import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { canManageCs, expectedBonus } from "@/lib/cs/cs-logic";
import { allRepsAnalytics, evaluatorStats } from "@/lib/cs/cs-report-service";
import { repBonusMap, getBonusTiers } from "@/lib/cs/cs-bonus-service";

export default async function CsAnalyticsPage() {
  const access = await requireUser();
  if (!canManageCs(access)) redirect("/cs-quality");
  const t = await getT();
  const [reps, bonuses, tiers, evaluators] = await Promise.all([
    allRepsAnalytics(new Date()),
    repBonusMap(),
    getBonusTiers(),
    evaluatorStats(),
  ]);
  const totalSubmitted = evaluators.reduce((s, e) => s + e.submitted, 0);
  const totalApproved = evaluators.reduce((s, e) => s + e.approved, 0);

  return (
    <AppShell access={access} moduleKey="cs_quality" pageTitle={t("cs.analytics")} backHref="/cs-quality">
      <div className="space-y-8">
        {/* Pharmacist scores (subjects) */}
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

        {/* Evaluator activity (who submitted, how many approved) */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{t("cs.evaluatorActivity")}</h2>
          <div className="mb-3 flex flex-wrap gap-x-8 gap-y-1 text-sm">
            <div><span className="text-muted">{t("cs.submittedCount")}: </span><span className="font-medium text-ink">{totalSubmitted}</span></div>
            <div><span className="text-muted">{t("cs.approvedCount")}: </span><span className="font-medium text-ink">{totalApproved}</span></div>
            <div><span className="text-muted">{t("cs.approvalRate")}: </span><span className="font-medium text-ink">{totalSubmitted ? Math.round((totalApproved / totalSubmitted) * 100) : 0}%</span></div>
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm" data-cards>
              <thead className="border-b border-line bg-canvas">
                <tr>
                  <th className="th">{t("cs.evaluator")}</th>
                  <th className="th text-end">{t("cs.submittedCount")}</th>
                  <th className="th text-end">{t("cs.approvedCount")}</th>
                  <th className="th text-end">{t("cs.approvalRate")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {evaluators.map((e) => (
                  <tr key={e.id} className="hover:bg-canvas/60">
                    <td className="td" data-label={t("cs.evaluator")}>{e.name}</td>
                    <td className="td text-end" data-label={t("cs.submittedCount")}>{e.submitted}</td>
                    <td className="td text-end" data-label={t("cs.approvedCount")}>{e.approved}</td>
                    <td className="td text-end text-muted" data-label={t("cs.approvalRate")}>{e.submitted ? Math.round((e.approved / e.submitted) * 100) : 0}%</td>
                  </tr>
                ))}
                {evaluators.length === 0 && <tr><td className="td text-muted" colSpan={4}>{t("cs.noEvaluations")}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
