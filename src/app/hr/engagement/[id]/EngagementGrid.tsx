"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { setEventEligiblesAction, setAchievementAction } from "../../engagement-actions";

interface Emp { id: number; label: string }
interface Crit { id: number; name: string; bonusAmount: number }

export function EngagementGrid({ eventId, allEmployees, eligible, eligibleIds, criteria, achievedKeys }: {
  eventId: number;
  allEmployees: Emp[];
  eligible: Emp[];
  eligibleIds: number[];
  criteria: Crit[];
  achievedKeys: string[];
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const achieved = new Set(achievedKeys);

  const [picking, setPicking] = useState(false);
  const [sel, setSel] = useState<Set<number>>(new Set(eligibleIds));
  const [filter, setFilter] = useState("");
  const toggleSel = (id: number) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const saveEligible = () => start(async () => { await setEventEligiblesAction(eventId, [...sel]); setPicking(false); router.refresh(); });
  const toggleAch = (criterionId: number, employeeId: number, on: boolean) => start(async () => { await setAchievementAction(eventId, criterionId, employeeId, on); router.refresh(); });

  const bonusFor = (employeeId: number) => criteria.reduce((sum, c) => sum + (achieved.has(`${c.id}:${employeeId}`) ? c.bonusAmount : 0), 0);
  const shown = allEmployees.filter((e) => e.label.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="space-y-4">
      {/* Eligibility */}
      <div className="card p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-ink">{t("eng.eligibleEmployees")} ({eligible.length})</h2>
          <button type="button" className="btn-secondary btn-sm" disabled={pending} onClick={() => setPicking((p) => !p)}>{picking ? t("common.cancel") : t("eng.editEligible")}</button>
        </div>
        {picking ? (
          <div className="mt-3 space-y-2">
            <input className="input" placeholder={t("eng.searchEmployee")} value={filter} onChange={(e) => setFilter(e.target.value)} />
            <div className="max-h-72 overflow-y-auto rounded-lg border border-line p-2">
              {shown.map((e) => (
                <label key={e.id} className="flex items-center gap-2 py-1 text-sm"><input type="checkbox" checked={sel.has(e.id)} onChange={() => toggleSel(e.id)} />{e.label}</label>
              ))}
              {shown.length === 0 && <p className="py-1 text-sm text-muted">—</p>}
            </div>
            <button type="button" className="btn-primary btn-sm" disabled={pending} onClick={saveEligible}>{t("hr.save")}</button>
          </div>
        ) : eligible.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{t("eng.noEligible")}</p>
        ) : (
          <p className="mt-2 text-sm text-muted">{eligible.map((e) => e.label).join(" · ")}</p>
        )}
      </div>

      {/* Achievement grid */}
      {eligible.length > 0 && criteria.length > 0 && (
        <div className="card overflow-x-auto p-5">
          <h2 className="mb-3 font-semibold text-ink">{t("eng.recordAchievements")}</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="th">{t("eng.employee")}</th>
                {criteria.map((c) => <th key={c.id} className="th text-center">{c.name}<span className="block text-[10px] font-normal text-muted">{c.bonusAmount}</span></th>)}
                <th className="th text-end">{t("eng.bonus")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {eligible.map((emp) => (
                <tr key={emp.id}>
                  <td className="td">{emp.label}</td>
                  {criteria.map((c) => {
                    const on = achieved.has(`${c.id}:${emp.id}`);
                    return <td key={c.id} className="td text-center"><input type="checkbox" checked={on} disabled={pending} onChange={() => toggleAch(c.id, emp.id, !on)} /></td>;
                  })}
                  <td className="td text-end font-medium text-ink">{bonusFor(emp.id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {eligible.length > 0 && criteria.length === 0 && <p className="text-sm text-muted">{t("eng.noCriteriaEvent")}</p>}
    </div>
  );
}
