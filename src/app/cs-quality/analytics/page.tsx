import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { canManageCs, expectedBonus } from "@/lib/cs/cs-logic";
import { allRepsAnalytics } from "@/lib/cs/cs-report-service";
import { repBonusMap, getBonusTiers } from "@/lib/cs/cs-bonus-service";

export default async function CsAnalyticsPage() {
  const access = await requireUser();
  if (!canManageCs(access)) redirect("/cs-quality");
  const t = await getT();
  const [reps, bonuses, tiers] = await Promise.all([allRepsAnalytics(new Date()), repBonusMap(), getBonusTiers()]);

  return (
    <AppShell access={access} moduleKey="cs_quality" pageTitle={t("cs.analytics")} backHref="/cs-quality">
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
    </AppShell>
  );
}
