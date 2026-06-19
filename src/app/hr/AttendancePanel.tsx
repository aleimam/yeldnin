"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { markAbsenceAction, clearAbsenceAction, setEmployeeAllowanceAction } from "./attendance-actions";

interface Bal {
  annual: { remaining: number; allowance: number };
  urgent: { remaining: number; allowance: number };
}
interface Absence {
  date: string;
  coveredByUrgent: boolean;
  note: string | null;
}

export function AttendancePanel({
  employeeId,
  balance,
  annualOverride,
  urgentOverride,
  absences,
}: {
  employeeId: number;
  balance: Bal;
  annualOverride: number | null;
  urgentOverride: number | null;
  absences: Absence[];
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [absDate, setAbsDate] = useState("");
  const [absNote, setAbsNote] = useState("");
  const [annual, setAnnual] = useState(annualOverride == null ? "" : String(annualOverride));
  const [urgent, setUrgent] = useState(urgentOverride == null ? "" : String(urgentOverride));
  const refresh = (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh(); });

  return (
    <div className="card space-y-4 border-brand/30 p-5">
      <h2 className="font-semibold text-ink">{t("hr.attendance")}</h2>
      <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
        <div><span className="text-muted">{t("leave.annual")}: </span><span className="text-ink">{balance.annual.remaining} / {balance.annual.allowance}</span></div>
        <div><span className="text-muted">{t("leave.urgent")}: </span><span className="text-ink">{balance.urgent.remaining} / {balance.urgent.allowance}</span></div>
      </div>

      <div className="space-y-2 border-t border-line pt-3">
        <h3 className="text-sm font-medium text-muted">{t("leave.allowanceOverride")}</h3>
        <div className="flex flex-wrap items-end gap-2">
          <label className="block"><span className="label">{t("leave.annual")}</span><input className="input w-24" type="number" placeholder={t("leave.default")} value={annual} onChange={(e) => setAnnual(e.target.value)} /></label>
          <label className="block"><span className="label">{t("leave.urgent")}</span><input className="input w-24" type="number" placeholder={t("leave.default")} value={urgent} onChange={(e) => setUrgent(e.target.value)} /></label>
          <button type="button" className="btn-secondary px-3 py-1.5 text-sm" disabled={pending} onClick={() => refresh(() => setEmployeeAllowanceAction(employeeId, annual === "" ? null : Number(annual), urgent === "" ? null : Number(urgent)))}>{t("hr.save")}</button>
        </div>
      </div>

      <div className="space-y-2 border-t border-line pt-3">
        <h3 className="text-sm font-medium text-muted">{t("leave.markAbsent")}</h3>
        <div className="flex flex-wrap items-end gap-2">
          <input className="input w-40" type="date" value={absDate} onChange={(e) => setAbsDate(e.target.value)} />
          <input className="input w-48" placeholder={t("leave.note")} value={absNote} onChange={(e) => setAbsNote(e.target.value)} />
          <button type="button" className="btn-secondary px-3 py-1.5 text-sm" disabled={pending || !absDate} onClick={() => refresh(async () => { await markAbsenceAction(employeeId, absDate, absNote || null); setAbsDate(""); setAbsNote(""); })}>{t("leave.markAbsent")}</button>
        </div>
        {absences.length > 0 && (
          <ul className="space-y-1 text-sm">
            {absences.map((a) => (
              <li key={a.date} className="flex items-center justify-between border-b border-line/60 py-1">
                <span>
                  {a.date}{" "}
                  {a.coveredByUrgent ? <span className="text-[10px] text-muted">({t("leave.urgent")})</span> : <span className="text-[10px] text-red-600">({t("leave.overLimit")})</span>}
                  {a.note && <span className="text-muted"> · {a.note}</span>}
                </span>
                <button type="button" className="text-xs text-red-600 hover:underline" disabled={pending} onClick={() => refresh(() => clearAbsenceAction(employeeId, a.date))}>{t("leave.clear")}</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
