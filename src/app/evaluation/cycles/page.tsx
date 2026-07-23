import Link from "next/link";
import { requireCapability } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { ActionForm } from "@/components/ActionForm";
import { formatBizDate } from "@/lib/format/dates";
import { listCycles } from "@/lib/evaluation/eval-cycle-service";
import { prisma } from "@/lib/db";
import { createCycleAction } from "./actions";

export default async function CyclesPage() {
  const access = await requireCapability("evaluation", "manage");
  const t = await getT();
  const [cycles, teams] = await Promise.all([
    listCycles(),
    prisma.team.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const hasOpen = cycles.some((c) => c.status === "OPEN");

  return (
    <AppShell access={access} moduleKey="evaluation" pageTitle={t("eval.cycles")}>
      <div className="space-y-6">
        <header>
          <h1 className="text-xl font-semibold text-ink">{t("eval.cycles")}</h1>
          <p className="text-sm text-muted">{t("eval.cyclesHint")}</p>
        </header>

        {/* New cycle */}
        {hasOpen ? (
          <p className="alert-info text-sm">{t("eval.oneOpenOnly")}</p>
        ) : (
          <ActionForm action={createCycleAction} className="card space-y-3 p-4" saveLabel={t("eval.openCycle")}>
            <h2 className="text-sm font-semibold text-ink">{t("eval.newCycle")}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">{t("eval.cycleName")}</label>
                <input name="name" required className="input" placeholder={t("eval.cycleNamePlaceholder")} />
              </div>
              <div>
                <label className="label">{t("eval.deadline")}</label>
                <input name="deadline" type="datetime-local" required className="input" />
              </div>
            </div>
            <div>
              <label className="label">{t("eval.includedDepartments")}</label>
              <div className="flex flex-wrap gap-2">
                {teams.map((tm) => (
                  <label key={tm.id} className="flex items-center gap-1.5 rounded border border-line px-2 py-1 text-sm text-ink">
                    <input type="checkbox" name="teamIds" value={tm.id} defaultChecked />
                    {tm.name}
                  </label>
                ))}
              </div>
            </div>
            <div className="max-w-[12rem]">
              <label className="label">{t("eval.effortWeight")}</label>
              <input name="effortWeight" type="number" min={0} max={100} defaultValue={15} className="input" />
              <p className="mt-1 text-xs text-muted">{t("eval.effortWeightHint")}</p>
            </div>
          </ActionForm>
        )}

        {/* Cycle list */}
        {cycles.length === 0 ? (
          <p className="text-sm text-muted">{t("eval.noCycles")}</p>
        ) : (
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-start">
                  <th className="th">{t("eval.cycleName")}</th>
                  <th className="th">{t("common.status")}</th>
                  <th className="th">{t("eval.deadline")}</th>
                  <th className="th text-end">{t("eval.participants")}</th>
                </tr>
              </thead>
              <tbody>
                {cycles.map((c) => (
                  <tr key={c.id} className="border-b border-line last:border-0 hover:bg-canvas/60">
                    <td className="td">
                      <Link href={`/evaluation/cycles/${c.id}`} className="font-medium text-brand hover:underline">
                        {c.name}
                      </Link>
                      <span className="ms-2 text-xs text-muted">{c.uid}</span>
                    </td>
                    <td className="td">
                      <span className={c.status === "OPEN" ? "text-green-600" : "text-muted"}>
                        {t(c.status === "OPEN" ? "eval.statusOpen" : "eval.statusClosed")}
                      </span>
                    </td>
                    <td className="td">{formatBizDate(c.deadline)}</td>
                    <td className="td text-end">{c.participantCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
