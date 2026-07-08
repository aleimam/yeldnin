import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { formatBizDate } from "@/lib/format/dates";
import { canAccessCs, canManageCs } from "@/lib/cs/cs-logic";
import { listPendingVetoes, listResolvedVetoes, listMyRelatedVetoes } from "@/lib/cs/cs-veto-service";
import { VetoResolveActions } from "../VetoResolveActions";
import { VetoStatusBadge } from "../VetoStatusBadge";

export default async function CsVetoesPage() {
  const access = await requireUser();
  if (!canAccessCs(access)) redirect("/cs-quality");
  const t = await getT();
  const manage = canManageCs(access);
  const me = access.user.id;

  const [mine, pending, resolved] = await Promise.all([
    listMyRelatedVetoes(me),
    manage ? listPendingVetoes() : Promise.resolve([]),
    manage ? listResolvedVetoes() : Promise.resolve([]),
  ]);

  // Evaluation ref cell — link unless the eval was deleted (upheld veto archives it).
  const evalRef = (v: { evaluationId: number; evalUid: string | null; scope: string; typeName: string | null; deleted: boolean }) => (
    <>
      {v.deleted ? (
        <span className="font-mono text-xs text-muted">{v.evalUid ?? `#${v.evaluationId}`}</span>
      ) : (
        <Link href={`/cs-quality/evaluations/${v.evaluationId}`} className="font-mono text-xs text-brand hover:underline">{v.evalUid ?? `#${v.evaluationId}`}</Link>
      )}
      <span className="block text-xs text-muted">{t(`cs.scope.${v.scope}`)}{v.typeName ? ` · ${v.typeName}` : ""}</span>
    </>
  );

  return (
    <AppShell access={access} moduleKey="cs_quality" pageTitle={t("cs.veto.title")} backHref="/cs-quality">
      <div className="max-w-5xl space-y-8">
        {/* Manager queue — pending vetoes awaiting a keep/delete decision. */}
        {manage && (
          <section>
            <div className="mb-2 flex items-center gap-2">
              <h2 className="font-semibold text-ink">{t("cs.veto.queue")}</h2>
              {pending.length > 0 && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600">{pending.length}</span>}
            </div>
            <p className="mb-3 max-w-2xl text-sm text-muted">{t("cs.veto.queueHint")}</p>
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
                  {pending.map((v) => (
                    <tr key={v.id} className="align-top hover:bg-canvas/60">
                      <td className="td" data-label={t("cs.veto.evaluation")}>{evalRef({ ...v, deleted: false })}</td>
                      <td className="td" data-label={t("cs.salesRep")}>{v.rep}</td>
                      <td className="td text-muted" data-label={t("cs.veto.note")}>{v.note}</td>
                      <td className="td whitespace-nowrap text-muted" data-datecol data-label={t("cs.date")}>{formatBizDate(v.createdAt)}</td>
                      <td className="td" data-label={t("cs.veto.decision")}><VetoResolveActions vetoId={v.id} /></td>
                    </tr>
                  ))}
                  {pending.length === 0 && <tr><td className="td text-muted" colSpan={5}>{t("cs.veto.queueEmpty")}</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Related to me — vetoes I cast + vetoes on evaluations I authored, with results. */}
        <section>
          <h2 className="mb-2 font-semibold text-ink">{t("cs.veto.mine")}</h2>
          <p className="mb-3 max-w-2xl text-sm text-muted">{t("cs.veto.mineHint")}</p>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm" data-cards>
              <thead className="border-b border-line bg-canvas">
                <tr>
                  <th className="th">{t("cs.veto.evaluation")}</th>
                  <th className="th">{t("cs.veto.role")}</th>
                  <th className="th">{t("cs.veto.party")}</th>
                  <th className="th">{t("cs.veto.note")}</th>
                  <th className="th">{t("cs.veto.result")}</th>
                  <th className="th">{t("cs.date")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {mine.map((v) => (
                  <tr key={v.id} className="align-top">
                    <td className="td" data-label={t("cs.veto.evaluation")}>{evalRef({ ...v, deleted: v.status === "UPHELD" })}</td>
                    <td className="td" data-label={t("cs.veto.role")}>
                      <span className="rounded bg-canvas px-1.5 py-0.5 text-xs text-muted">{t(`cs.veto.role.${v.role}`)}</span>
                    </td>
                    <td className="td text-ink" data-label={t("cs.veto.party")}>{v.counterparty}</td>
                    <td className="td text-muted" data-label={t("cs.veto.note")}>{v.note}</td>
                    <td className="td" data-label={t("cs.veto.result")}>
                      <VetoStatusBadge status={v.status} label={t(`cs.veto.status.${v.status}`)} />
                      {v.resolutionNote && <span className="ms-1 block text-xs text-muted">{v.resolutionNote}</span>}
                    </td>
                    <td className="td whitespace-nowrap text-muted" data-datecol data-label={t("cs.date")}>{formatBizDate(v.createdAt)}</td>
                  </tr>
                ))}
                {mine.length === 0 && <tr><td className="td text-muted" colSpan={6}>{t("cs.veto.mineEmpty")}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        {/* Resolved history (managers) — full record of kept/deleted vetoes. */}
        {manage && (
          <section>
            <h2 className="mb-2 font-semibold text-ink">{t("cs.veto.history")}</h2>
            <p className="mb-3 max-w-2xl text-sm text-muted">{t("cs.veto.historyHint")}</p>
            <div className="card overflow-x-auto">
              <table className="w-full text-sm" data-cards>
                <thead className="border-b border-line bg-canvas">
                  <tr>
                    <th className="th">{t("cs.veto.evaluation")}</th>
                    <th className="th">{t("cs.salesRep")}</th>
                    <th className="th">{t("cs.veto.evaluator")}</th>
                    <th className="th">{t("cs.veto.result")}</th>
                    <th className="th">{t("cs.veto.resolvedOn")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {resolved.map((v) => (
                    <tr key={v.id} className="align-top">
                      <td className="td" data-label={t("cs.veto.evaluation")}>{evalRef({ ...v, deleted: v.status === "UPHELD" })}</td>
                      <td className="td" data-label={t("cs.salesRep")}>{v.rep}</td>
                      <td className="td text-muted" data-label={t("cs.veto.evaluator")}>{v.evaluator}</td>
                      <td className="td" data-label={t("cs.veto.result")}>
                        <VetoStatusBadge status={v.status} label={t(`cs.veto.status.${v.status}`)} />
                        {v.resolutionNote && <span className="ms-1 block text-xs text-muted">{v.resolutionNote}</span>}
                      </td>
                      <td className="td whitespace-nowrap text-muted" data-datecol data-label={t("cs.veto.resolvedOn")}>
                        {v.resolvedAt ? formatBizDate(v.resolvedAt) : "—"}
                        {v.resolver && <span className="block text-xs text-muted">{t("cs.veto.resolvedBy", { name: v.resolver })}</span>}
                      </td>
                    </tr>
                  ))}
                  {resolved.length === 0 && <tr><td className="td text-muted" colSpan={5}>{t("cs.veto.historyEmpty")}</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
