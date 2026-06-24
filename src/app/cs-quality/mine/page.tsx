import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { formatBizDate } from "@/lib/format/dates";
import { canAccessCs, bonusPctFor, expectedBonus } from "@/lib/cs/cs-logic";
import { listEvaluations, repAnalytics, type EvalListRow } from "@/lib/cs/cs-report-service";
import { getRepBonus, getBonusTiers } from "@/lib/cs/cs-bonus-service";
import { myVetoQuota, vetoStatusByEval, listMyVetoes } from "@/lib/cs/cs-veto-service";
import { VetoButton } from "../VetoButton";
import { VetoStatusBadge } from "../VetoStatusBadge";

export default async function CsMinePage() {
  const access = await requireUser();
  if (!canAccessCs(access)) redirect("/cs-quality");
  const me = access.user.id;
  const [t, rows, an, maxBonus, tiers] = await Promise.all([
    getT(),
    listEvaluations({ subjectUserId: me, status: "APPROVED", showEvaluator: false }),
    repAnalytics(me),
    getRepBonus(me),
    getBonusTiers(),
  ]);
  const [quota, vetoMap, myVetoes] = await Promise.all([
    myVetoQuota(me),
    vetoStatusByEval(rows.map((r) => r.id)),
    listMyVetoes(me),
  ]);
  const cur = an.current.overall;
  const prev = an.previous.overall;
  const diff = (a: number | null, b: number | null) => (a !== null && b !== null ? Math.round((a - b) * 100) / 100 : null);
  const delta = diff(cur, prev);
  const blockCards = [
    { label: t("cs.callsBlock"), score: an.current.callsBlock, count: an.current.callsCount, delta: diff(an.current.callsBlock, an.previous.callsBlock), prev: an.previous.callsBlock },
    { label: t("cs.perfBlock"), score: an.current.perfBlock, count: an.current.perfCount, delta: diff(an.current.perfBlock, an.previous.perfBlock), prev: an.previous.perfBlock },
  ];
  const bonusPct = bonusPctFor(cur, tiers);
  const exp = expectedBonus(cur, maxBonus, tiers);

  const perf = rows.filter((e) => e.scope === "PERFORMANCE");
  const calls = rows.filter((e) => e.scope === "CALL");

  // Per-row veto cell: an existing veto shows its result; otherwise the veto button.
  const vetoCell = (e: EvalListRow) => {
    const st = vetoMap.get(e.id);
    return st ? <VetoStatusBadge status={st} label={t(`cs.veto.status.${st}`)} /> : <VetoButton evaluationId={e.id} remaining={quota.remaining} />;
  };
  const evalSection = (title: string, list: EvalListRow[], showMeta: boolean) => (
    <div className="card overflow-x-auto p-0">
      <div className="border-b border-line bg-canvas px-4 py-2 text-sm font-semibold text-ink">{title}</div>
      <table className="w-full text-sm" data-cards>
        <thead className="border-b border-line bg-canvas">
          <tr>
            {showMeta && <th className="th">{t("cs.scope")}</th>}
            <th className="th text-end">{t("cs.score")}</th>
            <th className="th text-end">{t("cs.normalized")}</th>
            <th className="th">{t("cs.date")}</th>
            <th className="th text-end">{t("cs.veto.veto")}</th>
            <th className="th"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {list.map((e) => (
            <tr key={e.id} className="hover:bg-canvas/60">
              {showMeta && (
                <td className="td" data-label={t("cs.scope")}>
                  {e.typeName || "—"}
                  {(e.channel || e.contact) && <span className="block text-xs text-muted">{[e.channel ? t(`cs.channel.${e.channel}`) : null, e.contact].filter(Boolean).join(" · ")}</span>}
                </td>
              )}
              <td className="td text-end" data-label={t("cs.score")}>{e.total}</td>
              <td className="td text-end" data-label={t("cs.normalized")}>{e.normalized}%</td>
              <td className="td text-muted" data-label={t("cs.date")}>{formatBizDate(e.date)}</td>
              <td className="td text-end" data-label={t("cs.veto.veto")}>{vetoCell(e)}</td>
              <td className="td text-end"><Link href={`/cs-quality/evaluations/${e.id}`} className="text-brand hover:underline">{t("cs.viewEval")}</Link></td>
            </tr>
          ))}
          {list.length === 0 && <tr><td className="td text-muted" colSpan={showMeta ? 6 : 5}>{t("cs.noEvaluations")}</td></tr>}
        </tbody>
      </table>
    </div>
  );

  return (
    <AppShell access={access} moduleKey="cs_quality" pageTitle={t("cs.myEvaluations")} backHref="/cs-quality">
      <div className="max-w-3xl space-y-6">
        {/* This-month overall (weighted composite) + last-month comparison */}
        <div className="card p-5 text-center">
          <div className="text-xs font-medium uppercase tracking-wide text-muted">{t("cs.overallThisMonth")}</div>
          <div className="mt-1 text-3xl font-bold text-ink">{cur === null ? "—" : `${cur}%`}</div>
          <div className="mt-1 text-xs text-muted">
            {prev === null ? (
              t("cs.noLastMonth")
            ) : (
              <>
                {t("cs.lastMonth")}: {prev}%
                {delta !== null && <span className={`ms-1 font-medium ${delta >= 0 ? "text-green-600" : "text-red-600"}`}>{delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}</span>}
              </>
            )}
          </div>
          <div className="mx-auto mt-3 max-w-sm border-t border-line/60 pt-3 text-sm">
            <span className="text-muted">{t("cs.expectedBonus")}: </span>
            <span className="font-semibold text-ink">{exp.toLocaleString()} {t("cs.egp")}</span>
            <span className="text-muted"> · {bonusPct}% {t("cs.ofMax")} {maxBonus.toLocaleString()} {t("cs.egp")}</span>
          </div>
        </div>

        {/* Breakdown: Calls block / Performance block */}
        <div className="card p-5">
          <h2 className="mb-3 font-semibold text-ink">{t("cs.breakdown")}</h2>
          <div className="mb-4 grid grid-cols-2 gap-3">
            {blockCards.map((b) => (
              <div key={b.label} className="rounded-lg border border-line p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-muted">{b.label}</div>
                {b.count === 0 ? (
                  <div className="mt-2 text-sm text-muted">{t("cs.noEvaluations")}</div>
                ) : (
                  <>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-ink">{b.score === null ? "—" : `${b.score}%`}</span>
                      {b.delta !== null && <span className={`text-xs font-medium ${b.delta >= 0 ? "text-green-600" : "text-red-600"}`}>{b.delta >= 0 ? "▲" : "▼"} {Math.abs(b.delta)}</span>}
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      {b.count} {t("cs.evaluationsCount")} · {b.prev === null ? t("cs.noLastMonth") : `${t("cs.lastMonth")}: ${b.prev}%`}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Veto section: monthly allowance (flags) + the user's used vetoes & results */}
        <div className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-ink">{t("cs.veto.section")}</h2>
            <div className="flex items-center gap-1" aria-label={t("cs.veto.remaining", { n: quota.remaining, total: quota.allowance })}>
              {Array.from({ length: quota.allowance }).map((_, i) => (
                <span key={i} className={i < quota.remaining ? "text-lg" : "text-lg opacity-25 grayscale"}>🚩</span>
              ))}
              <span className="ms-2 text-sm text-muted">{t("cs.veto.remaining", { n: quota.remaining, total: quota.allowance })}</span>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted">{t("cs.veto.hint")}</p>
          {myVetoes.length > 0 && (
            <table className="mt-3 w-full text-sm" data-cards>
              <thead className="border-b border-line"><tr>
                <th className="th">{t("cs.veto.evaluation")}</th>
                <th className="th">{t("cs.veto.note")}</th>
                <th className="th">{t("cs.veto.result")}</th>
                <th className="th">{t("cs.date")}</th>
              </tr></thead>
              <tbody className="divide-y divide-line">
                {myVetoes.map((v) => (
                  <tr key={v.id}>
                    <td className="td" data-label={t("cs.veto.evaluation")}>
                      {v.status === "UPHELD" ? (
                        <span className="font-mono text-xs text-muted">{v.evalUid ?? `#${v.evaluationId}`}</span>
                      ) : (
                        <Link href={`/cs-quality/evaluations/${v.evaluationId}`} className="font-mono text-xs text-brand hover:underline">{v.evalUid ?? `#${v.evaluationId}`}</Link>
                      )}
                      <span className="ms-1 text-xs text-muted">{t(`cs.scope.${v.scope}`)}{v.typeName ? ` · ${v.typeName}` : ""}</span>
                    </td>
                    <td className="td text-muted" data-label={t("cs.veto.note")}>{v.note}</td>
                    <td className="td" data-label={t("cs.veto.result")}>
                      <VetoStatusBadge status={v.status} label={t(`cs.veto.status.${v.status}`)} />
                      {v.resolutionNote && <span className="ms-1 block text-xs text-muted">{v.resolutionNote}</span>}
                    </td>
                    <td className="td text-muted" data-label={t("cs.date")}>{formatBizDate(v.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Evaluations — Performance on top, Calls below */}
        {evalSection(t("cs.perfEvaluations"), perf, false)}
        {evalSection(t("cs.callEvaluations"), calls, true)}
      </div>
    </AppShell>
  );
}
