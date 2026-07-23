import { notFound } from "next/navigation";
import { requireCapability } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { getLocale } from "@/i18n/server";
import { ActionForm } from "@/components/ActionForm";
import { formatBizDate } from "@/lib/format/dates";
import { displayName } from "@/lib/users/users-logic";
import { getCycleDashboard } from "@/lib/evaluation/eval-cycle-service";
import { extendDeadlineAction } from "../actions";
import { CloseCycleButton } from "../CloseCycleButton";

export default async function CycleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireCapability("evaluation", "manage");
  const t = await getT();
  const locale = await getLocale();
  const { id } = await params;
  const data = await getCycleDashboard(Number(id));
  if (!data) notFound();
  const { cycle, teamNames, rows, completeCount } = data;
  const open = cycle.status === "OPEN";

  return (
    <AppShell access={access} moduleKey="evaluation" pageTitle={cycle.name}>
      <div className="space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-ink">{cycle.name}</h1>
            <p className="text-sm text-muted">
              {cycle.uid} · {t(open ? "eval.statusOpen" : "eval.statusClosed")} · {teamNames.join(", ")}
            </p>
          </div>
          {open && <CloseCycleButton cycleId={cycle.id} />}
        </header>

        {/* Summary cards */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="card p-4">
            <p className="text-xs text-muted">{t("eval.participants")}</p>
            <p className="text-2xl font-semibold text-ink">{rows.length}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-muted">{t("eval.completed")}</p>
            <p className="text-2xl font-semibold text-ink">
              {completeCount}/{rows.length}
            </p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-muted">{t("eval.deadline")}</p>
            <p className="text-lg font-semibold text-ink">{formatBizDate(cycle.deadline)}</p>
          </div>
        </div>

        {/* Extend deadline (open only) */}
        {open && (
          <ActionForm action={extendDeadlineAction} className="card flex flex-wrap items-end gap-3 p-4" saveLabel={t("eval.extend")}>
            <input type="hidden" name="id" value={cycle.id} />
            <div>
              <label className="label">{t("eval.newDeadline")}</label>
              <input name="deadline" type="datetime-local" required className="input" />
            </div>
          </ActionForm>
        )}

        {/* Completion dashboard */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-ink">{t("eval.completionDashboard")}</h2>
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-start">
                  <th className="th">{t("eval.participant")}</th>
                  <th className="th">{t("hr.department")}</th>
                  <th className="th text-end">{t("eval.progress")}</th>
                  <th className="th">{t("common.status")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const pct = r.total ? Math.round((r.done / r.total) * 100) : 100;
                  return (
                    <tr key={r.empId} className="border-b border-line last:border-0">
                      <td className="td font-medium text-ink">{displayName({ name: r.name, nameAr: r.nameAr }, locale)}</td>
                      <td className="td text-muted">{r.teams}</td>
                      <td className="td text-end tabular-nums">
                        {r.done}/{r.total} <span className="text-muted">({pct}%)</span>
                      </td>
                      <td className="td">
                        {r.complete ? (
                          <span className="text-green-600">{t("eval.complete")}</span>
                        ) : (
                          <span className="text-amber-600">{t("eval.inProgress")}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
