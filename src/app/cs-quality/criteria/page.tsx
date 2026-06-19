import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT, getLocale } from "@/i18n/server";
import { canAccessCs, CS_SCOPES, isRep, localized } from "@/lib/cs/cs-logic";
import { listCsQuestions } from "@/lib/cs/cs-question-service";
import { repAnalytics, callTypeArNames } from "@/lib/cs/cs-report-service";
import { getCsConfig } from "@/lib/cs/cs-config-service";
import { getBonusTiers } from "@/lib/cs/cs-bonus-service";

// Read-only "what you're evaluated on" view — visible to anyone in CS Quality
// (reps, call-evaluators, admins). Admins still edit via the question pool.
export default async function CsCriteriaPage() {
  const access = await requireUser();
  if (!canAccessCs(access)) redirect("/");
  const me = access.user.id;
  const rep = isRep(access); // only the evaluated population sees their own scoring breakdown
  const [t, locale, questions, an, cfg, tiers, typeAr] = await Promise.all([
    getT(),
    getLocale(),
    listCsQuestions({ activeOnly: true }),
    repAnalytics(me),
    getCsConfig(),
    getBonusTiers(),
    callTypeArNames(),
  ]);

  // Scoring table: every call type (with its within-Calls weight + your monthly
  // average) plus a single Performance row at its split share. Both blocks'
  // split weights come from the config.
  const byType = an.current.byType; // call types this month: name, weight, avg
  const perfAvg = an.current.perfBlock; // pooled Performance average this month
  const split = cfg.split;
  // Highlight the top bonus tier (the goal row — e.g. ≥90% → 60%).
  const topBonus = tiers.length ? Math.max(...tiers.map((x) => x.bonusPct)) : -1;

  // Group active questions by scope → type (type label hidden when a scope has only one).
  const sections = CS_SCOPES.map((scope) => {
    const qs = questions.filter((q) => q.scope === scope);
    const groups: { typeId: number; typeName: string; items: typeof qs }[] = [];
    for (const q of qs) {
      let g = groups.find((x) => x.typeId === q.typeId);
      if (!g) {
        g = { typeId: q.typeId, typeName: localized(q.type.name, q.type.nameAr, locale), items: [] };
        groups.push(g);
      }
      g.items.push(q);
    }
    return { scope, groups, multiType: groups.length > 1 };
  }).filter((s) => s.groups.length > 0);

  return (
    <AppShell access={access} moduleKey="cs_quality" pageTitle={t("cs.criteriaTitle")} backHref="/cs-quality">
      <div className="max-w-3xl space-y-6">
        <p className="text-sm text-muted">{t("cs.criteriaIntro")}</p>

        {/* Rating scale: Bad · Good · Perfect grouped, with the two outliers boxed apart */}
        <div className="card p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{t("cs.ratings")}</p>
          <div className="flex items-stretch gap-2">
            <span className="flex flex-1 items-center justify-center rounded-lg border border-red-400 bg-red-50 px-2 py-2 text-center text-[11px] font-medium leading-tight text-red-700">
              {t("cs.level.CATASTROPHE")}
            </span>
            <div className="flex flex-[3] divide-x divide-line overflow-hidden rounded-lg border border-line bg-canvas/50">
              {(["BAD", "GOOD", "PERFECT"] as const).map((lvl) => (
                <span key={lvl} className="flex flex-1 items-center justify-center px-2 py-2 text-center text-[11px] font-medium leading-tight text-ink">
                  {t(`cs.level.${lvl}`)}
                </span>
              ))}
            </div>
            <span className="flex flex-1 items-center justify-center rounded-lg border border-green-400 bg-green-50 px-2 py-2 text-center text-[11px] font-medium leading-tight text-green-700">
              {t("cs.level.OUTSTANDING")}
            </span>
          </div>
        </div>

        {/* How you're scored — rep-only (personal monthly averages); admins/evaluators aren't the evaluated population */}
        {rep && (
        <div className="card p-5">
          <h2 className="mb-3 font-semibold text-ink">{t("cs.scoringTitle")}</h2>
          <table className="w-full text-sm" data-cards>
            <thead>
              <tr className="border-b border-line">
                <th className="th">{t("cs.type")}</th>
                <th className="th text-end">{t("cs.weight")}</th>
                <th className="th text-end">{t("cs.avgScore")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              <tr className="bg-canvas/60">
                <td className="td" colSpan={3}>
                  <span className="font-medium text-ink">{t("cs.scope.CALL")}</span>
                  <span className="ms-2 text-xs text-muted">{split.calls}% {t("cs.ofOverall")}</span>
                </td>
              </tr>
              {byType.map((ty) => (
                <tr key={ty.name}>
                  <td className="td ps-6" data-label={t("cs.type")}>{localized(ty.name, typeAr.get(ty.name), locale)}</td>
                  <td className="td text-end text-muted" data-label={t("cs.weight")}>{ty.weight}%</td>
                  <td className="td text-end" data-label={t("cs.avgScore")}>{ty.avg === null ? "—" : `${ty.avg}%`}</td>
                </tr>
              ))}
              <tr>
                <td className="td font-medium text-ink" data-label={t("cs.type")}>{t("cs.scope.PERFORMANCE")}</td>
                <td className="td text-end text-muted" data-label={t("cs.weight")}>{split.performance}%</td>
                <td className="td text-end" data-label={t("cs.avgScore")}>{perfAvg === null ? "—" : `${perfAvg}%`}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted">{t("cs.scoringNote")}</p>
        </div>
        )}

        {/* Bonus tiers (read-only) — the top tier is highlighted as the goal */}
        <div className="card p-5">
          <h2 className="mb-3 font-semibold text-ink">{t("cs.tiersTitle")}</h2>
          <table className="w-full text-sm" data-cards>
            <thead>
              <tr className="border-b border-line">
                <th className="th">{t("cs.tierFrom")}</th>
                <th className="th text-end">{t("cs.tierBonus")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {tiers.map((ti, i) => {
                const top = ti.bonusPct === topBonus;
                return (
                  <tr key={i} className={top ? "bg-brand/10 font-semibold text-ink" : ""}>
                    <td className="td" data-label={t("cs.tierFrom")}>≥ {ti.fromPct}%</td>
                    <td className="td text-end" data-label={t("cs.tierBonus")}>{ti.bonusPct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {sections.length === 0 && <div className="card p-6 text-sm text-muted">{t("cs.noQuestions")}</div>}

        {sections.map((s) => (
          <section key={s.scope} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t(`cs.scope.${s.scope}`)}</h2>
            {s.groups.map((g) => (
              <div key={g.typeId} className="space-y-2">
                {s.multiType && <p className="text-xs font-medium text-muted">{g.typeName}</p>}
                {g.items.map((q) => (
                  <div key={q.id} className="card space-y-1 p-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-semibold text-ink">{localized(q.title, q.titleAr, locale)}</p>
                      <span className="shrink-0 text-xs text-muted">×{q.weight}</span>
                    </div>
                    {localized(q.criteria, q.criteriaAr, locale) && <p className="text-sm text-muted">{localized(q.criteria, q.criteriaAr, locale)}</p>}
                    {localized(q.tags ?? "", q.tagsAr, locale) && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {localized(q.tags ?? "", q.tagsAr, locale)
                          .split(",")
                          .map((x) => x.trim())
                          .filter(Boolean)
                          .map((tag) => (
                            <span key={tag} className="rounded bg-canvas px-1.5 py-0.5 text-[10px] text-muted">
                              {tag}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </section>
        ))}
      </div>
    </AppShell>
  );
}
