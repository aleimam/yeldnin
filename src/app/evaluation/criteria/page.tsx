import { requireCapability } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listConfig } from "@/lib/evaluation/eval-config-service";
import { DeleteButton } from "@/components/DeleteButton";
import {
  createPillarAction,
  updatePillarAction,
  archivePillarById,
  createCriterionAction,
  updateCriterionAction,
  archiveCriterionById,
} from "./actions";

const SCOPES = ["ANY", "CONNECTED", "SAME_DEPT"] as const;

export default async function CriteriaAdminPage() {
  const access = await requireCapability("evaluation", "manage");
  const t = await getT();
  const { pillars, teams } = await listConfig();

  return (
    <AppShell access={access} moduleKey="evaluation" pageTitle={t("eval.criteria")}>
      <div className="space-y-6">
        <header>
          <h1 className="text-xl font-semibold text-ink">{t("eval.criteria")}</h1>
          <p className="text-sm text-muted">{t("eval.criteriaHint")}</p>
        </header>

        {/* Add a pillar */}
        <form action={createPillarAction} className="card flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-[12rem] flex-1">
            <label className="label">{t("eval.pillarName")}</label>
            <input name="name" required className="input" />
          </div>
          <div className="min-w-[12rem] flex-1">
            <label className="label">{t("eval.pillarNameAr")}</label>
            <input name="nameAr" dir="rtl" className="input" />
          </div>
          <button className="btn-primary">{t("eval.addPillar")}</button>
        </form>

        {pillars.length === 0 && <p className="text-sm text-muted">{t("eval.noPillars")}</p>}

        {pillars.map((p) => (
          <section key={p.id} className="card space-y-4 p-4">
            {/* Pillar header + team applicability */}
            <form action={updatePillarAction} className="space-y-3">
              <input type="hidden" name="id" value={p.id} />
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[12rem] flex-1">
                  <label className="label">{t("eval.pillarName")}</label>
                  <input name="name" defaultValue={p.name} required className="input" />
                </div>
                <div className="min-w-[12rem] flex-1">
                  <label className="label">{t("eval.pillarNameAr")}</label>
                  <input name="nameAr" defaultValue={p.nameAr ?? ""} dir="rtl" className="input" />
                </div>
              </div>
              <div>
                <label className="label">{t("eval.appliesTo")}</label>
                <p className="mb-1.5 text-xs text-muted">{t("eval.appliesToHint")}</p>
                {teams.length === 0 ? (
                  <p className="text-xs text-muted">{t("eval.noTeams")}</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {teams.map((tm) => (
                      <label key={tm.id} className="flex items-center gap-1.5 rounded border border-line px-2 py-1 text-sm text-ink">
                        <input type="checkbox" name="teamIds" value={tm.id} defaultChecked={p.teamIds.includes(tm.id)} />
                        {tm.name}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button className="btn-primary btn-sm">{t("common.save")}</button>
                {p.teamIds.length === 0 && <span className="text-xs text-muted">{t("eval.appliesAll")}</span>}
              </div>
            </form>

            {/* Criteria */}
            <div className="space-y-3 border-t border-line pt-3">
              <h3 className="text-sm font-semibold text-ink">
                {t("eval.criteriaList")} ({p.criteria.length})
              </h3>

              {p.criteria.map((c) => (
                <form key={c.id} action={updateCriterionAction} className="space-y-2 rounded-lg border border-line p-3">
                  <input type="hidden" name="id" value={c.id} />
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-[10rem] flex-1">
                      <label className="label">{t("eval.critTitle")}</label>
                      <input name="title" defaultValue={c.title} required className="input" />
                    </div>
                    <div className="min-w-[10rem] flex-1">
                      <label className="label">{t("eval.critTitleAr")}</label>
                      <input name="titleAr" defaultValue={c.titleAr ?? ""} dir="rtl" className="input" />
                    </div>
                    <div className="min-w-[10rem]">
                      <label className="label">{t("eval.raterScope")}</label>
                      <select name="raterScope" defaultValue={c.raterScope} className="input">
                        {SCOPES.map((s) => (
                          <option key={s} value={s}>
                            {t(`eval.scope.${s}`)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <div className="min-w-[12rem] flex-1">
                      <label className="label">{t("eval.critText")}</label>
                      <textarea name="text" defaultValue={c.text} rows={2} className="input" />
                    </div>
                    <div className="min-w-[12rem] flex-1">
                      <label className="label">{t("eval.critTextAr")}</label>
                      <textarea name="textAr" defaultValue={c.textAr ?? ""} dir="rtl" rows={2} className="input" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <button className="btn-primary btn-sm">{t("common.save")}</button>
                    <DeleteButton onDelete={archiveCriterionById.bind(null, c.id)} confirmKey="eval.archiveCriterionConfirm" />
                  </div>
                </form>
              ))}

              {/* Add a criterion */}
              <form action={createCriterionAction} className="flex flex-wrap items-end gap-2 rounded-lg bg-canvas/40 p-3">
                <input type="hidden" name="pillarId" value={p.id} />
                <div className="min-w-[10rem] flex-1">
                  <label className="label">{t("eval.critTitle")}</label>
                  <input name="title" required className="input" />
                </div>
                <div className="min-w-[12rem] flex-[2]">
                  <label className="label">{t("eval.critText")}</label>
                  <input name="text" className="input" />
                </div>
                <button className="btn-primary btn-sm">{t("eval.addCriterion")}</button>
              </form>
            </div>

            {/* Archive whole pillar */}
            <div className="flex items-center justify-end gap-2 border-t border-line pt-3">
              <span className="text-xs text-muted">{t("eval.archivePillar")}</span>
              <DeleteButton onDelete={archivePillarById.bind(null, p.id)} confirmKey="eval.archivePillarConfirm" />
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
