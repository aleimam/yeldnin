import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT, getLocale } from "@/i18n/server";
import { canAccessCs, CS_LEVELS, CS_SCOPES, localized } from "@/lib/cs/cs-logic";
import { listCsQuestions } from "@/lib/cs/cs-question-service";

// Catastrophe red … Outstanding green; middle three neutral (mirrors the eval form).
const TONE: Record<string, string> = {
  CATASTROPHE: "border-red-400 bg-red-50 text-red-700",
  BAD: "border-line text-ink",
  GOOD: "border-line text-ink",
  PERFECT: "border-line text-ink",
  OUTSTANDING: "border-green-400 bg-green-50 text-green-700",
};

// Read-only "what you're evaluated on" view — visible to anyone in CS Quality
// (reps, call-evaluators, admins). Admins still edit via the question pool.
export default async function CsCriteriaPage() {
  const access = await requireUser();
  if (!canAccessCs(access)) redirect("/");
  const [t, locale, questions] = await Promise.all([getT(), getLocale(), listCsQuestions({ activeOnly: true })]);

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

        <div className="card p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{t("cs.ratings")}</p>
          <div className="grid grid-cols-5 gap-1.5">
            {CS_LEVELS.map((lvl) => (
              <span
                key={lvl}
                className={`rounded-lg border px-1 py-1.5 text-center text-[11px] font-medium leading-tight ${TONE[lvl]}`}
              >
                {t(`cs.level.${lvl}`)}
              </span>
            ))}
          </div>
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
