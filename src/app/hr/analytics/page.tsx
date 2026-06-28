import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { salaryAnalytics, bonusPenaltyAgg, companyActivity } from "@/lib/hr/hr-analytics-service";
import { engagementAnalytics } from "@/lib/hr/engagement-service";
import { getLocale } from "@/i18n/server";
import { formatEgp as fmt } from "@/lib/format/money";

export default async function HrAnalyticsPage() {
  const access = await requireUser();
  if (!access.isAdmin && !access.can("human_resources", "manage")) redirect("/hr");
  const t = await getT();
  const now = new Date();
  const [salary, bp, activity, eng, locale] = await Promise.all([
    salaryAnalytics({ year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 }),
    bonusPenaltyAgg(),
    companyActivity(40),
    engagementAnalytics(),
    getLocale(),
  ]);
  const engName = (x: { templateName: string; templateNameAr: string | null }) => (locale === "ar" && x.templateNameAr ? x.templateNameAr : x.templateName);
  const trendMax = Math.max(1, ...salary.trend.map((m) => m.net));
  const teamMax = Math.max(1, ...salary.byTeam.map((tm) => tm.total));

  return (
    <AppShell access={access} moduleKey="human_resources" pageTitle={t("an.title")} backHref="/hr">
      <div className="max-w-4xl space-y-6">
        {/* Salary headline */}
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label={t("dash.headcount")} value={String(salary.headcount)} />
          <Stat label={t("an.projectedMonthly")} value={fmt(salary.projectedTotal)} />
          <Stat label={t("an.average")} value={fmt(salary.average)} />
          <Stat label={t("an.median")} value={fmt(salary.median)} />
        </div>

        {/* Actuals trend */}
        <div className="card space-y-3 p-5">
          <h2 className="font-semibold text-ink">{t("an.trend")}</h2>
          <p className="text-xs text-muted">{t("an.trendDesc")}</p>
          <div className="space-y-1.5">
            {salary.trend.map((m) => (
              <div key={m.label} className="flex items-center gap-2 text-sm">
                <span className="w-16 shrink-0 text-muted">{m.label}</span>
                <div className="h-4 flex-1 rounded bg-canvas"><div className="h-4 rounded bg-brand/70" style={{ width: `${(m.net / trendMax) * 100}%` }} /></div>
                <span className="w-24 shrink-0 text-end text-ink">{fmt(m.net)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* By team */}
        {salary.byTeam.length > 0 && (
          <div className="card space-y-3 p-5">
            <h2 className="font-semibold text-ink">{t("an.byTeam")}</h2>
            <p className="text-xs text-muted">{t("an.byTeamDesc")}</p>
            <div className="space-y-1.5">
              {salary.byTeam.map((tm) => (
                <div key={tm.name} className="flex items-center gap-2 text-sm">
                  <span className="w-28 shrink-0 truncate text-ink">{tm.name}</span>
                  <div className="h-4 flex-1 rounded bg-canvas"><div className="h-4 rounded bg-brand/60" style={{ width: `${(tm.total / teamMax) * 100}%` }} /></div>
                  <span className="w-24 shrink-0 text-end text-muted">{fmt(tm.total)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bonuses & penalties */}
        <div className="card space-y-4 p-5">
          <h2 className="font-semibold text-ink">{t("an.bp")}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Stat label={t("pay.bonuses")} value={fmt(bp.bonusTotal)} tone="green" />
            <Stat label={t("pay.penalties")} value={fmt(bp.penaltyTotal)} tone="red" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Breakdown title={t("pay.bonuses")} rows={bp.bonusByLabel} empty={t("an.none")} />
            <Breakdown title={t("pay.penalties")} rows={bp.penaltyByLabel} empty={t("an.none")} />
          </div>
          {bp.recent.length > 0 && (
            <div>
              <div className="label mb-1">{t("an.recent")}</div>
              <ul className="divide-y divide-line/60 text-sm">
                {bp.recent.map((r, i) => (
                  <li key={i} className="flex flex-wrap items-baseline gap-x-3 py-1.5">
                    <span className="whitespace-nowrap text-xs text-muted">{r.month}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] ${r.kind === "BONUS" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{t(r.kind === "BONUS" ? "comp.bonus" : "comp.penalty")}</span>
                    <span className="text-ink">{r.name}</span>
                    <span className="text-muted">{r.label}</span>
                    <span className="ms-auto font-medium text-ink">{fmt(r.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Engagement */}
        <div className="card space-y-4 p-5">
          <h2 className="font-semibold text-ink">{t("eng.title")}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-cards>
              <thead className="border-b border-line bg-canvas">
                <tr>
                  <th className="th">{t("eng.event")}</th>
                  <th className="th">{t("eng.payMonth")}</th>
                  <th className="th text-end">{t("eng.eligible")}</th>
                  <th className="th text-end">{t("eng.participated")}</th>
                  <th className="th text-end">{t("eng.bonus")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {eng.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="td" data-label={t("eng.event")}><a href={`/hr/engagement/${r.id}`} className="text-brand hover:underline">{r.title || engName(r)}</a></td>
                    <td className="td text-muted" data-label={t("eng.payMonth")}>{r.year}-{String(r.month).padStart(2, "0")}</td>
                    <td className="td text-end text-muted" data-label={t("eng.eligible")}>{r.eligible}</td>
                    <td className="td text-end text-muted" data-label={t("eng.participated")}>{r.participants}</td>
                    <td className="td text-end font-medium text-ink" data-label={t("eng.bonus")}>{fmt(r.bonus)}</td>
                  </tr>
                ))}
                {eng.rows.length === 0 && <tr><td className="td text-muted" colSpan={5}>{t("eng.noEvents")}</td></tr>}
              </tbody>
            </table>
          </div>
          {eng.top.length > 0 && (
            <div>
              <div className="label mb-1">{t("eng.topEarners")}</div>
              <ul className="divide-y divide-line/60 text-sm">
                {eng.top.map((e, i) => (
                  <li key={i} className="flex items-center justify-between py-1.5"><span className="text-ink">{e.name}</span><span className="font-medium text-ink">{fmt(e.bonus)}</span></li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Activity feed */}
        <div className="card space-y-2 p-5">
          <h2 className="font-semibold text-ink">{t("an.activity")}</h2>
          <ol className="space-y-1.5">
            {activity.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 border-b border-line/50 py-1.5 text-sm">
                <span className="whitespace-nowrap text-xs text-muted">{new Date(e.createdAt).toLocaleDateString()}</span>
                <span className="rounded bg-canvas px-1.5 py-0.5 text-[10px] text-muted">{t(`hr.event.${e.type}`)}</span>
                <a href={`/hr/employees/${e.employeeId}`} className="text-brand hover:underline">{e.name}</a>
                <span className="text-ink">{e.message}</span>
              </li>
            ))}
            {activity.length === 0 && <li className="text-sm text-muted">—</li>}
          </ol>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "green" | "red" }) {
  const color = tone === "green" ? "text-green-600" : tone === "red" ? "text-red-600" : "text-ink";
  return (
    <div className="card p-4">
      <div className="label">{label}</div>
      <div className={`text-xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function Breakdown({ title, rows, empty }: { title: string; rows: { label: string; total: number }[]; empty: string }) {
  return (
    <div>
      <div className="label mb-1">{title}</div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-line/60 text-sm">
          {rows.map((r) => (
            <li key={r.label} className="flex items-baseline justify-between py-1"><span className="text-ink">{r.label}</span><span className="text-muted">{fmt(r.total)}</span></li>
          ))}
        </ul>
      )}
    </div>
  );
}
