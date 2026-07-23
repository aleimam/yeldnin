import Link from "next/link";
import { requireCapability } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT, getLocale } from "@/i18n/server";
import { displayName } from "@/lib/users/users-logic";
import { prisma } from "@/lib/db";
import { RadarChart } from "@/components/evaluation/RadarChart";
import {
  listClosedCycles,
  scopeAnalytics,
  participantsWithOverall,
  raterDetail,
  fairnessFlags,
  myResults,
} from "@/lib/evaluation/eval-analytics-service";

const f1 = (v: number | null | undefined) => (v == null ? "—" : v.toFixed(1));

type SP = { cycle?: string; scope?: string; dept?: string; emp?: string };

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const access = await requireCapability("evaluation", "manage");
  const t = await getT();
  const locale = await getLocale();
  const sp = await searchParams;

  const cycles = await listClosedCycles();
  if (cycles.length === 0) {
    return (
      <AppShell access={access} moduleKey="evaluation" pageTitle={t("eval.analytics")}>
        <div className="space-y-4">
          <h1 className="text-xl font-semibold text-ink">{t("eval.analytics")}</h1>
          <p className="alert-info text-sm">{t("eval.noClosedCycles")}</p>
        </div>
      </AppShell>
    );
  }

  const cycleId = Number(sp.cycle) || cycles[0].id;
  const scope = sp.scope === "dept" || sp.scope === "emp" ? sp.scope : "all";
  const loc = (name: string, nameAr: string | null) => (locale === "ar" && nameAr ? nameAr : name);
  const qs = (o: Partial<SP>) => {
    const p = new URLSearchParams({ cycle: String(cycleId), scope, ...(sp.dept ? { dept: sp.dept } : {}), ...(sp.emp ? { emp: sp.emp } : {}), ...o } as Record<string, string>);
    return `/evaluation/analytics?${p.toString()}`;
  };

  const PillarBars = ({ pillars }: { pillars: { pillarId: number; name: string; nameAr: string | null; avg: number | null; responses: number }[] }) => (
    <div className="space-y-1.5">
      {pillars.map((p) => (
        <div key={p.pillarId} className="flex items-center gap-2 text-xs">
          <span className="w-40 shrink-0 truncate text-ink">{loc(p.name, p.nameAr)}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-canvas">
            <div className="h-full bg-brand" style={{ width: `${p.avg != null ? Math.round((p.avg / 5) * 100) : 0}%` }} />
          </div>
          <span className="w-8 text-end tabular-nums text-ink">{f1(p.avg)}</span>
          <span className="w-10 text-end tabular-nums text-muted">n={p.responses}</span>
        </div>
      ))}
    </div>
  );

  return (
    <AppShell access={access} moduleKey="evaluation" pageTitle={t("eval.analytics")}>
      <div className="space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-ink">{t("eval.analytics")}</h1>
          <a href={`/api/evaluation/${cycleId}/csv`} className="btn-sm border border-line">
            ⬇ {t("eval.exportCsv")}
          </a>
        </header>

        {/* cycle picker */}
        <div className="flex flex-wrap gap-2">
          {cycles.map((c) => (
            <Link
              key={c.id}
              href={`/evaluation/analytics?cycle=${c.id}&scope=${scope}`}
              className={`btn-sm border ${c.id === cycleId ? "border-brand bg-brand/10 text-brand" : "border-line text-ink"}`}
            >
              {c.name}
            </Link>
          ))}
        </div>

        {/* scope tabs */}
        <div className="flex gap-2 border-b border-line">
          {(["all", "dept", "emp"] as const).map((s) => (
            <Link
              key={s}
              href={`/evaluation/analytics?cycle=${cycleId}&scope=${s}`}
              className={`-mb-px border-b-2 px-3 py-1.5 text-sm ${scope === s ? "border-brand font-medium text-brand" : "border-transparent text-muted"}`}
            >
              {t(s === "all" ? "eval.scopeAll" : s === "dept" ? "eval.scopeDept" : "eval.scopeEmp")}
            </Link>
          ))}
        </div>

        {scope === "all" && (await AllStaff({ cycleId, t, PillarBars }))}
        {scope === "dept" && (await ByDept({ cycleId, teamId: sp.dept ? Number(sp.dept) : null, qs, t, PillarBars }))}
        {scope === "emp" && (await ByEmp({ cycleId, empId: sp.emp ? Number(sp.emp) : null, qs, t, loc, locale }))}
      </div>
    </AppShell>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function AllStaff({ cycleId, t, PillarBars }: any) {
  const [data, flags] = await Promise.all([scopeAnalytics(cycleId), fairnessFlags(cycleId)]);
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs text-muted">{t("eval.overallScore")}</p>
          <p className="text-2xl font-semibold text-ink">{f1(data.overall.avg)}<span className="text-base text-muted"> / 5</span></p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted">{t("eval.participants")}</p>
          <p className="text-2xl font-semibold text-ink">{data.overall.subjects}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted">{t("eval.responses")}</p>
          <p className="text-2xl font-semibold text-ink">{data.overall.responses}</p>
        </div>
      </div>
      <div className="card p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink">{t("eval.byPillar")}</h2>
        {data.pillars.length ? <PillarBars pillars={data.pillars} /> : <p className="text-sm text-muted">{t("eval.noPeerData")}</p>}
      </div>
      <div className="card p-4">
        <h2 className="mb-2 text-sm font-semibold text-ink">{t("eval.fairnessFlags")}</h2>
        {flags.length === 0 ? (
          <p className="text-sm text-muted">{t("eval.noFlags")}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {flags.map((fl: any, i: number) => (
              <li key={i} className="text-muted">
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">{t(`eval.flag.${fl.type}`)}</span>{" "}
                {fl.evaluatorName ?? ""} {fl.subjectName ? `→ ${fl.subjectName}` : ""} <span className="text-ink">{fl.detail}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-muted">{t("eval.flagsHint")}</p>
      </div>
    </div>
  );
}

async function ByDept({ cycleId, teamId, qs, t, PillarBars }: any) {
  const cycleTeams = await prisma.evalCycleTeam.findMany({ where: { cycleId }, select: { teamId: true } });
  const teams = cycleTeams.length
    ? await prisma.team.findMany({ where: { id: { in: cycleTeams.map((c: any) => c.teamId) } }, orderBy: { name: "asc" }, select: { id: true, name: true } })
    : [];
  const data = teamId ? await scopeAnalytics(cycleId, teamId) : null;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {teams.map((tm: any) => (
          <Link key={tm.id} href={qs({ dept: String(tm.id) })} className={`btn-sm border ${tm.id === teamId ? "border-brand bg-brand/10 text-brand" : "border-line text-ink"}`}>
            {tm.name}
          </Link>
        ))}
      </div>
      {!data ? (
        <p className="text-sm text-muted">{t("eval.pickDept")}</p>
      ) : (
        <>
          <div className="card p-4">
            <p className="text-xs text-muted">{t("eval.overallScore")}</p>
            <p className="text-2xl font-semibold text-ink">
              {f1(data.overall.avg)}<span className="text-base text-muted"> / 5</span>
              <span className="ms-2 text-sm text-muted">({data.overall.subjects} · n={data.overall.responses})</span>
            </p>
          </div>
          <div className="card p-4">
            <h2 className="mb-3 text-sm font-semibold text-ink">{t("eval.byPillar")}</h2>
            {data.pillars.length ? <PillarBars pillars={data.pillars} /> : <p className="text-sm text-muted">{t("eval.noPeerData")}</p>}
          </div>
        </>
      )}
    </div>
  );
}

async function ByEmp({ cycleId, empId, qs, t, loc, locale }: any) {
  const people = await participantsWithOverall(cycleId);
  const [res, raters] = empId ? await Promise.all([myResults(cycleId, empId), raterDetail(cycleId, empId)]) : [null, []];
  const radarPillars = res ? res.pillars.filter((p: any) => p.score != null) : [];
  const axes = radarPillars.map((p: any) => loc(p.name, p.nameAr));
  const series = [
    { label: t("eval.others"), color: "var(--brand)", values: radarPillars.map((p: any) => p.score) },
    { label: t("eval.you"), color: "#f59e0b", values: radarPillars.map((p: any) => p.self) },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
      {/* people list */}
      <div className="card max-h-[70vh] overflow-y-auto p-0">
        {people.map((p: any) => (
          <Link
            key={p.empId}
            href={qs({ emp: String(p.empId) })}
            className={`flex items-center justify-between gap-2 border-b border-line px-3 py-2 text-sm last:border-0 hover:bg-canvas/60 ${p.empId === empId ? "bg-brand/10" : ""}`}
          >
            <span className="min-w-0 truncate text-ink">{displayName({ name: p.name, nameAr: p.nameAr }, locale)}</span>
            <span className="tabular-nums text-muted">{f1(p.overall)}</span>
          </Link>
        ))}
      </div>

      {/* detail */}
      <div className="space-y-4">
        {!res ? (
          <p className="text-sm text-muted">{t("eval.pickEmployee")}</p>
        ) : !res.hasData ? (
          <p className="alert-info text-sm">{t("eval.noPeerData")}</p>
        ) : (
          <>
            <div className="card p-4">
              <p className="text-xs text-muted">{t("eval.overallScore")}</p>
              <p className="text-2xl font-semibold text-ink">
                {f1(res.overall.score)}<span className="text-base text-muted"> / 5</span>
                <span className="ms-2 text-sm text-muted">{t("eval.selfLabel")} {f1(res.overall.self)} · n={res.overall.responses}</span>
              </p>
            </div>
            {axes.length >= 3 && (
              <div className="card p-4 text-ink">
                <RadarChart axes={axes} series={series} />
              </div>
            )}
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
                  {res.pillars.map((p: any) => (
                    <tr key={p.pillarId} className="border-b border-line last:border-0">
                      <td className="td text-ink">{loc(p.name, p.nameAr)}</td>
                      <td className="td text-end tabular-nums">{f1(p.score)}</td>
                      <td className="td text-end tabular-nums text-muted">{f1(p.self)}</td>
                      <td className="td text-end tabular-nums text-muted">{p.responses}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* raters + comments (admin only) */}
            <div className="card p-4">
              <h2 className="mb-2 text-sm font-semibold text-ink">{t("eval.raters")}</h2>
              <ul className="space-y-2 text-sm">
                {raters.map((r: any) => (
                  <li key={r.evaluatorEmpId} className="border-b border-line pb-2 last:border-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-ink">
                        {displayName({ name: r.name, nameAr: r.nameAr }, locale)}
                        {r.isSelf && <span className="ms-1 text-xs text-muted">({t("eval.self")})</span>}
                        {r.dominant && <span className="ms-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">{t("eval.flag.dominant_rater")}</span>}
                      </span>
                      <span className="text-xs text-muted">
                        {r.status === "NA" ? t("eval.na") : r.weightShare != null ? `${Math.round(r.weightShare * 100)}%` : ""}
                      </span>
                    </div>
                    {r.overallComment && <p className="mt-0.5 text-xs text-muted">{r.overallComment}</p>}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
