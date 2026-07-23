import { notFound, redirect } from "next/navigation";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT, getLocale } from "@/i18n/server";
import { formatBizDate } from "@/lib/format/dates";
import { RadarChart } from "@/components/evaluation/RadarChart";
import { myEmployeeId } from "@/lib/evaluation/eval-evaluate-service";
import { myResults } from "@/lib/evaluation/eval-analytics-service";

const fmt = (v: number | null | undefined) => (v == null ? "—" : v.toFixed(1));

export default async function ResultsPage({ params }: { params: Promise<{ cycle: string }> }) {
  const access = await requireModule("evaluation", "VIEW");
  const t = await getT();
  const locale = await getLocale();
  const { cycle: cycleParam } = await params;

  const empId = access.user ? await myEmployeeId(access.user.id) : null;
  if (!empId) redirect("/evaluation/results");
  const data = await myResults(Number(cycleParam), empId);
  if (!data) notFound();

  const loc = (name: string, nameAr: string | null) => (locale === "ar" && nameAr ? nameAr : name);
  const pct = (v: number | null) => (v == null ? null : Math.round((v / 5) * 100));

  // Radar: peer vs self across pillars that have a peer score.
  const radarPillars = data.pillars.filter((p) => p.score != null);
  const axes = radarPillars.map((p) => loc(p.name, p.nameAr));
  const radarSeries = [
    { label: t("eval.others"), color: "var(--brand)", values: radarPillars.map((p) => p.score) },
    { label: t("eval.you"), color: "#f59e0b", values: radarPillars.map((p) => p.self) },
  ];

  const delta = data.overall.delta;

  return (
    <AppShell access={access} moduleKey="evaluation" pageTitle={t("eval.myResults")}>
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <h1 className="text-xl font-semibold text-ink">{data.cycle.name}</h1>
          <p className="text-sm text-muted">
            {data.cycle.status === "CLOSED" ? t("eval.statusClosed") : t("eval.statusOpen")}
            {data.cycle.closedAt ? ` · ${formatBizDate(data.cycle.closedAt)}` : ""}
          </p>
        </header>

        {data.cycle.status !== "CLOSED" ? (
          <p className="alert-info text-sm">{t("eval.resultsPending")}</p>
        ) : !data.hasData ? (
          <p className="alert-info text-sm">{t("eval.noPeerData")}</p>
        ) : (
          <>
            {/* Overall */}
            <div className="card p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs text-muted">{t("eval.overallScore")}</p>
                  <p className="text-3xl font-semibold text-ink">
                    {fmt(data.overall.score)}
                    <span className="text-base text-muted"> / 5</span>
                    <span className="ms-2 text-base text-muted">({pct(data.overall.score)}%)</span>
                  </p>
                </div>
                {delta != null && (
                  <span className={`text-sm font-medium ${delta > 0 ? "text-green-600" : delta < 0 ? "text-red-600" : "text-muted"}`}>
                    {delta > 0 ? "▲" : delta < 0 ? "▼" : "—"} {Math.abs(delta).toFixed(1)} {t("eval.vsLastCycle")}
                  </span>
                )}
              </div>
              <p className="mt-2 text-xs text-muted">
                {t("eval.selfLabel")}: {fmt(data.overall.self)} · {t("eval.responsesN", { n: String(data.overall.responses) })}
                {data.overall.provisional && <span className="ms-2 rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">{t("eval.provisional")}</span>}
              </p>
            </div>

            {/* Self vs others radar */}
            {axes.length >= 3 && (
              <div className="card p-5">
                <h2 className="mb-2 text-sm font-semibold text-ink">{t("eval.selfVsOthers")}</h2>
                <div className="text-ink">
                  <RadarChart axes={axes} series={radarSeries} />
                </div>
                <div className="mt-2 flex justify-center gap-4 text-xs">
                  <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm bg-brand" />{t("eval.others")}</span>
                  <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm" style={{ background: "#f59e0b" }} />{t("eval.you")}</span>
                </div>
              </div>
            )}

            {/* Per-pillar */}
            <div className="card overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-start">
                    <th className="th">{t("eval.pillar")}</th>
                    <th className="th text-end">{t("eval.others")}</th>
                    <th className="th text-end">{t("eval.you")}</th>
                    <th className="th text-end">{t("eval.responses")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pillars.map((p) => (
                    <tr key={p.pillarId} className="border-b border-line last:border-0">
                      <td className="td font-medium text-ink">
                        {loc(p.name, p.nameAr)}
                        {p.provisional && <span className="ms-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">{t("eval.provisional")}</span>}
                      </td>
                      <td className="td text-end tabular-nums">{fmt(p.score)}</td>
                      <td className="td text-end tabular-nums text-muted">{fmt(p.self)}</td>
                      <td className="td text-end tabular-nums text-muted">{p.responses}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Effort */}
            {data.effortCoveragePct != null && (
              <div className="card p-4 text-sm">
                <span className="text-muted">{t("eval.effortCoverage")}: </span>
                <span className="font-medium text-ink">{data.effortCoveragePct}%</span>
                <p className="mt-1 text-xs text-muted">{t("eval.effortNote")}</p>
              </div>
            )}

            {/* Trend */}
            {data.trend.length > 1 && (
              <div className="card p-4">
                <h2 className="mb-2 text-sm font-semibold text-ink">{t("eval.trend")}</h2>
                <div className="space-y-1.5">
                  {data.trend.map((tp, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="w-32 shrink-0 truncate text-muted">{tp.cycleName}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-canvas">
                        <div className="h-full bg-brand" style={{ width: `${Math.round((tp.overall / 5) * 100)}%` }} />
                      </div>
                      <span className="w-8 text-end tabular-nums text-ink">{tp.overall.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI report (P5) */}
            <div className="card p-4">
              <h2 className="mb-1 text-sm font-semibold text-ink">{t("eval.aiReport")}</h2>
              {data.reportMd ? (
                <div className="whitespace-pre-wrap text-sm text-ink">{data.reportMd}</div>
              ) : (
                <p className="text-sm text-muted">{t("eval.reportPending")}</p>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
