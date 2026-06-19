"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { setHrConfigAction } from "../attendance-actions";

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

export function HrConfigForm({ annualDefault, urgentDefault, weeklyOffDays }: { annualDefault: number; urgentDefault: number; weeklyOffDays: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [annual, setAnnual] = useState(String(annualDefault));
  const [urgent, setUrgent] = useState(String(urgentDefault));
  const [off, setOff] = useState<Set<number>>(new Set(weeklyOffDays.split(",").map((s) => parseInt(s, 10)).filter((n) => !isNaN(n))));
  const [ok, setOk] = useState(false);

  const toggle = (d: number) => setOff((s) => { const n = new Set(s); if (n.has(d)) n.delete(d); else n.add(d); return n; });
  const save = () => start(async () => { await setHrConfigAction(Number(annual) || 0, Number(urgent) || 0, [...off].sort().join(",")); setOk(true); router.refresh(); });

  return (
    <div className="card space-y-3 p-5">
      <h2 className="font-semibold text-ink">{t("leave.config")}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className="label">{t("leave.annualDefault")}</span><input className="input" type="number" value={annual} onChange={(e) => { setAnnual(e.target.value); setOk(false); }} /></label>
        <label className="block"><span className="label">{t("leave.urgentDefault")}</span><input className="input" type="number" value={urgent} onChange={(e) => { setUrgent(e.target.value); setOk(false); }} /></label>
      </div>
      <div>
        <span className="label">{t("leave.weeklyOff")}</span>
        <div className="flex flex-wrap gap-3">
          {WEEKDAYS.map((d) => (
            <label key={d} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={off.has(d)} onChange={() => { toggle(d); setOk(false); }} />{t(`weekday.${d}`)}</label>
          ))}
        </div>
      </div>
      {ok && <p className="text-sm text-green-600">{t("common.saved")}</p>}
      <button type="button" className="btn-primary" disabled={pending} onClick={save}>{t("hr.save")}</button>
    </div>
  );
}
