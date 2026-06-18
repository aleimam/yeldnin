import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { formatBizDate } from "@/lib/format/dates";
import { canEvaluateCalls } from "@/lib/cs/cs-logic";
import { listEvaluations } from "@/lib/cs/cs-report-service";

export default async function CsSubmittedPage() {
  const access = await requireUser();
  if (!canEvaluateCalls(access)) redirect("/cs-quality");
  const [t, rows] = await Promise.all([getT(), listEvaluations({ evaluatorUserId: access.user.id, showEvaluator: false })]);

  return (
    <AppShell access={access} moduleKey="cs_quality" pageTitle={t("cs.submitted")} backHref="/cs-quality">
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-canvas">
            <tr>
              <th className="th">{t("cs.salesRep")}</th>
              <th className="th">{t("cs.scope")}</th>
              <th className="th">{t("cs.status")}</th>
              <th className="th text-end">{t("cs.score")}</th>
              <th className="th">{t("cs.date")}</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((e) => (
              <tr key={e.id} className="hover:bg-canvas/60">
                <td className="td">{e.subject}</td>
                <td className="td text-muted">{t(`cs.scope.${e.scope}`)}{e.typeName ? ` · ${e.typeName}` : ""}</td>
                <td className="td">{t(`cs.status.${e.status}`)}</td>
                <td className="td text-end">{e.total}</td>
                <td className="td text-muted">{formatBizDate(e.date)}</td>
                <td className="td text-end"><Link href={`/cs-quality/evaluations/${e.id}`} className="text-brand hover:underline">{t("cs.viewEval")}</Link></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="td text-muted" colSpan={6}>{t("cs.noEvaluations")}</td></tr>}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
