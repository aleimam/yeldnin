"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { PayslipBreakdown, type PaySlip, type PayLine } from "./PayslipBreakdown";
import { generatePayslipAction, recomputePayslipAction, addTargetAction, addAdhocAction, removeLineAction, lockPayslipAction } from "./payroll-actions";

interface SlipWithLines extends PaySlip {
  lines: PayLine[];
}
type Targets = Record<number, { componentId: number; name: string; amount: number }[]>;

const thisMonth = () => new Date().toISOString().slice(0, 7); // YYYY-MM

export function PayrollPanel({ employeeId, slips, targets }: { employeeId: number; slips: SlipWithLines[]; targets: Targets }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [month, setMonth] = useState(thisMonth());
  const [err, setErr] = useState<string | null>(null);

  const generate = () => {
    setErr(null);
    const [y, m] = month.split("-").map(Number);
    start(async () => {
      const r = await generatePayslipAction(employeeId, y, m);
      if (!r.ok) { setErr(r.error); return; }
      router.refresh();
    });
  };

  return (
    <div className="card space-y-4 p-5">
      <h2 className="font-semibold text-ink">{t("pay.title")}</h2>
      <div className="flex flex-wrap items-center gap-2">
        <input className="input h-9 w-44 py-0 text-sm" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        <button type="button" className="btn-primary px-3 py-1.5 text-sm" disabled={pending || !month} onClick={generate}>{t("pay.generate")}</button>
        <span className="text-xs text-muted">{t("pay.generateHint")}</span>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}

      {slips.length === 0 && <p className="text-sm text-muted">{t("pay.none")}</p>}
      <div className="space-y-3">
        {slips.map((s) => (
          <div key={s.id} className="rounded-lg border border-line p-4">
            <SlipCard employeeId={employeeId} slip={s} targets={targets[s.id] ?? []} pending={pending} start={start} router={router} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SlipCard({ employeeId, slip, targets, pending, start, router }: { employeeId: number; slip: SlipWithLines; targets: { componentId: number; name: string; amount: number }[]; pending: boolean; start: (fn: () => void) => void; router: ReturnType<typeof useRouter> }) {
  const t = useT();
  const draft = slip.status === "DRAFT";
  const remove = (lineId: number) => start(async () => { await removeLineAction(employeeId, slip.id, lineId); router.refresh(); });

  return (
    <div className="space-y-3">
      <PayslipBreakdown slip={slip} lines={slip.lines} onRemove={draft ? remove : undefined} pending={pending} />
      {draft && (
        <div className="space-y-3 border-t border-line pt-3">
          <AddTarget employeeId={employeeId} payslipId={slip.id} targets={targets} pending={pending} start={start} router={router} />
          <AddAdhoc employeeId={employeeId} payslipId={slip.id} pending={pending} start={start} router={router} />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-secondary px-3 py-1.5 text-sm" disabled={pending} onClick={() => start(async () => { await recomputePayslipAction(employeeId, slip.id); router.refresh(); })}>{t("pay.recompute")}</button>
            <button type="button" className="btn-primary px-3 py-1.5 text-sm" disabled={pending} onClick={() => { if (confirm(t("pay.lockConfirm"))) start(async () => { await lockPayslipAction(employeeId, slip.id); router.refresh(); }); }}>{t("pay.lock")}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddTarget({ employeeId, payslipId, targets, pending, start, router }: { employeeId: number; payslipId: number; targets: { componentId: number; name: string; amount: number }[]; pending: boolean; start: (fn: () => void) => void; router: ReturnType<typeof useRouter> }) {
  const t = useT();
  const [componentId, setComponentId] = useState("");
  if (!targets.length) return null;
  const add = () => { if (!componentId) return; start(async () => { await addTargetAction(employeeId, payslipId, Number(componentId)); setComponentId(""); router.refresh(); }); };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted">{t("pay.addTarget")}:</span>
      <select className="input h-8 w-52 py-0 text-xs" value={componentId} onChange={(e) => setComponentId(e.target.value)}>
        <option value="">{t("salary.component")}</option>
        {targets.map((tg) => <option key={tg.componentId} value={tg.componentId}>{tg.name} · {tg.amount}</option>)}
      </select>
      <button type="button" className="btn-secondary px-2 py-1 text-xs" disabled={pending || !componentId} onClick={add}>{t("salary.add")}</button>
    </div>
  );
}

function AddAdhoc({ employeeId, payslipId, pending, start, router }: { employeeId: number; payslipId: number; pending: boolean; start: (fn: () => void) => void; router: ReturnType<typeof useRouter> }) {
  const t = useT();
  const [f, setF] = useState({ kind: "BONUS", mode: "FIXED", label: "", value: "" });
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));
  const add = () => {
    setErr(null);
    start(async () => {
      const input = { kind: f.kind as "BONUS" | "PENALTY", mode: f.mode as "FIXED" | "DAYS", label: f.label, amount: f.mode === "FIXED" ? Number(f.value) : null, days: f.mode === "DAYS" ? Number(f.value) : null };
      const r = await addAdhocAction(employeeId, payslipId, input);
      if (!r.ok) { setErr(r.error); return; }
      setF({ kind: "BONUS", mode: "FIXED", label: "", value: "" });
      router.refresh();
    });
  };
  return (
    <div className="space-y-1">
      <span className="text-sm text-muted">{t("pay.addAdhoc")}:</span>
      <div className="flex flex-wrap items-center gap-2">
        <select className="input h-8 w-28 py-0 text-xs" value={f.kind} onChange={set("kind")}><option value="BONUS">{t("comp.bonus")}</option><option value="PENALTY">{t("comp.penalty")}</option></select>
        <select className="input h-8 w-32 py-0 text-xs" value={f.mode} onChange={set("mode")}><option value="FIXED">{t("pay.modeFixed")}</option><option value="DAYS">{t(f.kind === "BONUS" ? "pay.modeDaysBasic" : "pay.modeDaysTotal")}</option></select>
        <input className="input h-8 w-40 py-0 text-xs" placeholder={t("comp.name")} value={f.label} onChange={set("label")} />
        <input className="input h-8 w-24 py-0 text-xs" type="number" step="0.01" placeholder={f.mode === "FIXED" ? t("salary.amount") : t("pay.days")} value={f.value} onChange={set("value")} />
        <button type="button" className="btn-secondary px-2 py-1 text-xs" disabled={pending || !f.label || !f.value} onClick={add}>{t("salary.add")}</button>
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  );
}
