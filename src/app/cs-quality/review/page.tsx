import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { formatBizDate } from "@/lib/format/dates";
import { canManageCs } from "@/lib/cs/cs-logic";
import { listEvaluations } from "@/lib/cs/cs-report-service";

export default async function CsReviewPage() {
  const access = await requireUser();
  if (!canManageCs(access)) redirect("/cs-quality");
  const [t, rows] = await Promise.all([getT(), listEvaluations({ status: "PENDING", showEvaluator: true })]);

  return (
    <AppShell access={access} moduleKey="cs_quality" pageTitle={t("cs.reviewQueue")} backHref="/cs-quality">
      <div className="card overflow-x-auto">
        <table className="w-full text-sm" data-cards>
          <thead className="border-b border-line bg-canvas">
            <tr>
              <th className="th">{t("cs.salesRep")}</th>
              <th className="th">{t("cs.scope")}</th>
              <th className="th">{t("cs.evaluator")}</th>
              <th className="th text-end">{t("cs.score")}</th>
              <th className="th text-end">{t("cs.normalized")}</th>
              <th className="th">{t("cs.date")}</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((e) => (
              <tr key={e.id} className="hover:bg-canvas/60">
                <td className="td" data-label={t("cs.salesRep")}>{e.subject}</td>
                <td className="td text-muted" data-label={t("cs.scope")}>
                  {t(`cs.scope.${e.scope}`)}{e.typeName ? ` · ${e.typeName}` : ""}
                  {(e.channel || e.contact) && <span className="block text-xs">{[e.channel ? t(`cs.channel.${e.channel}`) : null, e.contact].filter(Boolean).join(" · ")}</span>}
                </td>
                <td className="td text-muted" data-label={t("cs.evaluator")}>{e.evaluator}</td>
                <td className="td text-end" data-label={t("cs.score")}>{e.total}</td>
                <td className="td text-end" data-label={t("cs.normalized")}>{e.normalized}%</td>
                <td className="td text-muted" data-label={t("cs.date")}>{formatBizDate(e.date)}</td>
                <td className="td text-end"><Link href={`/cs-quality/evaluations/${e.id}`} className="text-brand hover:underline">{t("cs.review")}</Link></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="td text-muted" colSpan={7}>{t("cs.noPending")}</td></tr>}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
