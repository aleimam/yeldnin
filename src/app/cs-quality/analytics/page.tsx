import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { canManageCs } from "@/lib/cs/cs-logic";
import { allRepsAnalytics } from "@/lib/cs/cs-report-service";

export default async function CsAnalyticsPage() {
  const access = await requireUser();
  if (!canManageCs(access)) redirect("/cs-quality");
  const t = await getT();
  const reps = await allRepsAnalytics(new Date());

  return (
    <AppShell access={access} moduleKey="cs_quality" pageTitle={t("cs.analytics")} backHref="/cs-quality">
      <div className="card overflow-x-auto">
        <table className="w-full text-sm" data-cards>
          <thead className="border-b border-line bg-canvas">
            <tr>
              <th className="th">{t("cs.salesRep")}</th>
              <th className="th text-end">{t("cs.evaluationsCount")}</th>
              <th className="th text-end">{t("cs.avgScore")}</th>
              <th className="th text-end">{t("cs.thisMonthSum")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {reps.map((r) => (
              <tr key={r.id} className="hover:bg-canvas/60">
                <td className="td" data-label={t("cs.salesRep")}>{r.name}</td>
                <td className="td text-end text-muted" data-label={t("cs.evaluationsCount")}>{r.count}</td>
                <td className="td text-end font-medium" data-label={t("cs.avgScore")}>{r.avgNormalized}%</td>
                <td className="td text-end" data-label={t("cs.thisMonthSum")}>{r.monthSum}</td>
              </tr>
            ))}
            {reps.length === 0 && <tr><td className="td text-muted" colSpan={4}>{t("cs.noEvaluations")}</td></tr>}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
