import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { formatBizDate } from "@/lib/format/dates";
import { canManageCs } from "@/lib/cs/cs-logic";
import { listPendingVetoes } from "@/lib/cs/cs-veto-service";
import { VetoResolveActions } from "../VetoResolveActions";

export default async function CsVetoesPage() {
  const access = await requireUser();
  if (!canManageCs(access)) redirect("/cs-quality");
  const [t, rows] = await Promise.all([getT(), listPendingVetoes()]);

  return (
    <AppShell access={access} moduleKey="cs_quality" pageTitle={t("cs.veto.queue")} backHref="/cs-quality">
      <p className="mb-4 max-w-2xl text-sm text-muted">{t("cs.veto.queueHint")}</p>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm" data-cards>
          <thead className="border-b border-line bg-canvas">
            <tr>
              <th className="th">{t("cs.veto.evaluation")}</th>
              <th className="th">{t("cs.salesRep")}</th>
              <th className="th">{t("cs.veto.note")}</th>
              <th className="th">{t("cs.date")}</th>
              <th className="th text-end">{t("cs.veto.decision")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((v) => (
              <tr key={v.id} className="align-top hover:bg-canvas/60">
                <td className="td" data-label={t("cs.veto.evaluation")}>
                  <Link href={`/cs-quality/evaluations/${v.evaluationId}`} className="font-mono text-xs text-brand hover:underline">{v.evalUid ?? `#${v.evaluationId}`}</Link>
                  <span className="block text-xs text-muted">{t(`cs.scope.${v.scope}`)}{v.typeName ? ` · ${v.typeName}` : ""}</span>
                </td>
                <td className="td" data-label={t("cs.salesRep")}>{v.rep}</td>
                <td className="td text-muted" data-label={t("cs.veto.note")}>{v.note}</td>
                <td className="td whitespace-nowrap text-muted" data-datecol data-label={t("cs.date")}>{formatBizDate(v.createdAt)}</td>
                <td className="td" data-label={t("cs.veto.decision")}><VetoResolveActions vetoId={v.id} /></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="td text-muted" colSpan={5}>{t("cs.veto.queueEmpty")}</td></tr>}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
