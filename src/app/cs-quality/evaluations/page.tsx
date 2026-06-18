import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { formatBizDate } from "@/lib/format/dates";
import { canManageCs } from "@/lib/cs/cs-logic";
import { listEvaluations } from "@/lib/cs/cs-report-service";
import { ReviewActions } from "../ReviewActions";

const STATUS_TONE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
};

// Admin-only registry of every evaluation — all subjects, all evaluators, all
// statuses (most recent first). Reps reach their own via /cs-quality/mine.
export default async function CsAllEvaluationsPage() {
  const access = await requireUser();
  if (!canManageCs(access)) redirect("/cs-quality");
  const [t, rows] = await Promise.all([
    getT(),
    listEvaluations({ showEvaluator: true, take: 1000 }),
  ]);

  return (
    <AppShell access={access} moduleKey="cs_quality" pageTitle={t("cs.allEvaluations")} backHref="/cs-quality">
      <div className="card overflow-x-auto">
        <table className="w-full text-sm" data-cards>
          <thead className="border-b border-line bg-canvas">
            <tr>
              <th className="th">{t("cs.uid")}</th>
              <th className="th">{t("cs.salesRep")}</th>
              <th className="th">{t("cs.scope")}</th>
              <th className="th">{t("cs.evaluator")}</th>
              <th className="th">{t("cs.status")}</th>
              <th className="th text-end">{t("cs.normalized")}</th>
              <th className="th">{t("cs.date")}</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((e) => (
              <tr key={e.id} className="hover:bg-canvas/60">
                <td className="td" data-label={t("cs.uid")}>
                  <Link href={`/cs-quality/evaluations/${e.id}`} className="font-medium text-brand hover:underline">{e.uid ?? `#${e.id}`}</Link>
                </td>
                <td className="td" data-label={t("cs.salesRep")}>{e.subject}</td>
                <td className="td text-muted" data-label={t("cs.scope")}>
                  {t(`cs.scope.${e.scope}`)}{e.typeName ? ` · ${e.typeName}` : ""}
                  {(e.channel || e.contact) && <span className="block text-xs">{[e.channel ? t(`cs.channel.${e.channel}`) : null, e.contact].filter(Boolean).join(" · ")}</span>}
                </td>
                <td className="td text-muted" data-label={t("cs.evaluator")}>{e.evaluator}</td>
                <td className="td" data-label={t("cs.status")}>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[e.status] ?? "bg-canvas text-muted"}`}>{t(`cs.status.${e.status}`)}</span>
                </td>
                <td className="td text-end" data-label={t("cs.normalized")}>{e.normalized}%</td>
                <td className="td text-muted whitespace-nowrap" data-label={t("cs.date")}>{formatBizDate(e.date)}</td>
                <td className="td" data-label={t("cs.review")}>{e.status === "PENDING" && <ReviewActions id={e.id} />}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="td text-muted" colSpan={8}>{t("cs.noEvaluations")}</td></tr>}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
