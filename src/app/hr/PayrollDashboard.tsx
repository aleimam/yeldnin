"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { formatEgp as fmt } from "@/lib/format/money";
import { generateAllDraftsAction, lockPayslipAction } from "./payroll-actions";

interface Row {
  employeeId: number;
  name: string;
  projected: number;
  status: string;
  payslipId: number | null;
  net: number | null;
}
interface Totals {
  headcount: number;
  projected: number;
  runNet: number;
  locked: number;
  draft: number;
  none: number;
}

const statusClass: Record<string, string> = { NONE: "bg-canvas text-muted", DRAFT: "bg-amber-100 text-amber-700", LOCKED: "bg-green-100 text-green-700" };

export function PayrollDashboard({ year, month, rows, totals }: { year: number; month: number; rows: Row[]; totals: Totals }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const value = `${year}-${String(month).padStart(2, "0")}`;

  const go = (v: string) => {
    const [y, m] = v.split("-").map(Number);
    if (y && m) router.push(`/hr/payroll?y=${y}&m=${m}`);
  };
  const generateAll = () => {
    setMsg(null);
    start(async () => {
      const r = await generateAllDraftsAction(year, month);
      setMsg(r.ok ? { ok: true, text: t("dash.generatedN", { n: r.count }) } : { ok: false, text: r.error });
      router.refresh();
    });
  };
  const lock = (employeeId: number, payslipId: number) => {
    if (!confirm(t("pay.lockConfirm"))) return;
    start(async () => { await lockPayslipAction(employeeId, payslipId); router.refresh(); });
  };

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <input className="input h-9 w-44 py-0 text-sm" type="month" value={value} onChange={(e) => go(e.target.value)} />
        <button type="button" className="btn-primary px-3 py-1.5 text-sm" disabled={pending} onClick={generateAll}>{t("dash.generateAll")}</button>
        <span className="text-xs text-muted">{t("dash.generateAllHint")}</span>
        {msg && <span className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</span>}
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label={t("dash.headcount")} value={String(totals.headcount)} />
        <Stat label={t("dash.projected")} value={fmt(totals.projected)} />
        <Stat label={t("dash.runNet")} value={fmt(totals.runNet)} />
        <Stat label={t("dash.status")} value={`${totals.locked} ${t("pay.status.LOCKED")} · ${totals.draft} ${t("pay.status.DRAFT")} · ${totals.none} —`} small />
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm" data-cards>
          <thead>
            <tr>
              <th className="th text-start">{t("hr.employees")}</th>
              <th className="th text-end">{t("dash.projected")}</th>
              <th className="th text-center">{t("pay.title")}</th>
              <th className="th text-end">{t("pay.net")}</th>
              <th className="th text-end"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.employeeId}>
                <td className="td" data-label={t("hr.employees")}><Link href={`/hr/employees/${r.employeeId}`} className="text-brand hover:underline">{r.name}</Link></td>
                <td className="td text-end" data-label={t("dash.projected")}>{fmt(r.projected)}</td>
                <td className="td text-center" data-label={t("dash.status")}><span className={`rounded px-2 py-0.5 text-[11px] ${statusClass[r.status] ?? "bg-canvas text-muted"}`}>{r.status === "NONE" ? "—" : t(`pay.status.${r.status}`)}</span></td>
                <td className="td text-end" data-label={t("pay.net")}>{r.net != null ? fmt(r.net) : "—"}</td>
                <td className="td text-end">{r.status === "DRAFT" && r.payslipId && <button type="button" className="text-xs text-brand hover:underline" disabled={pending} onClick={() => lock(r.employeeId, r.payslipId!)}>{t("pay.lock")}</button>}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="td text-muted" colSpan={5}>—</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="card p-4">
      <div className="label">{label}</div>
      <div className={small ? "text-xs text-ink" : "text-xl font-semibold text-ink"}>{value}</div>
    </div>
  );
}
