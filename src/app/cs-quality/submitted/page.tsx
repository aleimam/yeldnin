import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { formatBizDate } from "@/lib/format/dates";
import { canEvaluateCalls } from "@/lib/cs/cs-logic";
import { listEvaluations, evalFilterOptions } from "@/lib/cs/cs-report-service";
import { EvalFilters } from "../EvalFilters";

export default async function CsSubmittedPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const access = await requireUser();
  if (!canEvaluateCalls(access)) redirect("/cs-quality");
  const sp = await searchParams;
  const month = sp.month || undefined;
  const subjectUserId = sp.reviewee && Number(sp.reviewee) > 0 ? Number(sp.reviewee) : undefined;
  const [t, rows, options] = await Promise.all([
    getT(),
    listEvaluations({ evaluatorUserId: access.user.id, showEvaluator: false, month, subjectUserId }),
    evalFilterOptions(),
  ]);

  return (
    <AppShell access={access} moduleKey="cs_quality" pageTitle={t("cs.submitted")} backHref="/cs-quality">
      <EvalFilters
        basePath="/cs-quality/submitted"
        current={{ month: sp.month ?? "", evaluator: "", reviewee: sp.reviewee ?? "" }}
        evaluators={[]}
        reviewees={options.reviewees}
      />
      <p className="mb-3 text-sm text-muted">{t("cs.evalCount", { n: rows.length })}</p>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm" data-cards>
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
                <td className="td" data-label={t("cs.salesRep")}>{e.subject}</td>
                <td className="td text-muted" data-label={t("cs.scope")}>
                  {t(`cs.scope.${e.scope}`)}{e.typeName ? ` · ${e.typeName}` : ""}
                  {(e.channel || e.contact) && <span className="block text-xs">{[e.channel ? t(`cs.channel.${e.channel}`) : null, e.contact].filter(Boolean).join(" · ")}</span>}
                </td>
                <td className="td" data-label={t("cs.status")}>{t(`cs.status.${e.status}`)}</td>
                <td className="td text-end" data-label={t("cs.score")}>{e.total}</td>
                <td className="td text-muted" data-label={t("cs.date")}>{formatBizDate(e.date)}</td>
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
