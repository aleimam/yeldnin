"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { CHANGE_TYPES } from "@/lib/hr/salary-logic";
import { formatEgp as fmt } from "@/lib/format/money";
import { applyLineChangeAction, setLineActiveAction } from "./salary-actions";

export interface SalaryLine {
  id: number;
  componentId: number;
  code: string;
  name: string;
  nameAr: string | null;
  kind: string;
  valuation: string;
  amount: number;
  active: boolean;
}
export interface Eligible {
  id: number;
  name: string;
  nameAr: string | null;
  kind: string;
  valuation: string;
  defaultAmount: number | null;
}
export interface SalaryChangeView {
  id: number;
  date: string;
  changeType: string;
  delta: number;
  oldAmount: number;
  newAmount: number;
  reason: string | null;
  componentName: string;
}

const KINDS = ["EARNING", "BONUS", "PENALTY"] as const;
const kindKey: Record<string, string> = { EARNING: "comp.earning", BONUS: "comp.bonus", PENALTY: "comp.penalty" };
const today = () => new Date().toISOString().slice(0, 10);

export function SalaryPanel({
  employeeId,
  lines,
  monthlyBase,
  eligible,
  changes,
  readOnly = false,
}: {
  employeeId: number;
  lines: SalaryLine[];
  monthlyBase: number;
  eligible: Eligible[];
  changes: SalaryChangeView[];
  readOnly?: boolean;
}) {
  const t = useT();

  return (
    <div className="card space-y-4 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold text-ink">{t("salary.title")}</h2>
        <span className="text-sm text-muted">{t("salary.monthlyBase")}: <span className="font-semibold text-ink">{fmt(monthlyBase)}</span></span>
      </div>

      {lines.length === 0 && <p className="text-sm text-muted">{t("salary.noStructure")}</p>}

      {KINDS.map((kind) => {
        const group = lines.filter((l) => l.kind === kind);
        if (!group.length) return null;
        return (
          <div key={kind} className="space-y-1">
            <div className="label">{t(kindKey[kind])}</div>
            <div className="space-y-1">
              {group.map((l) => <LineRow key={l.id} employeeId={employeeId} line={l} readOnly={readOnly} />)}
            </div>
          </div>
        );
      })}

      {!readOnly && eligible.length > 0 && <AddComponent employeeId={employeeId} eligible={eligible} />}

      {changes.length > 0 && (
        <div className="space-y-1">
          <div className="label">{t("salary.history")}</div>
          <ul className="divide-y divide-line/60 text-sm">
            {changes.map((c) => (
              <li key={c.id} className="flex flex-wrap items-baseline gap-x-3 py-1.5">
                <span className="whitespace-nowrap text-xs text-muted">{c.date}</span>
                <span className="text-ink">{c.componentName}</span>
                <span className="rounded bg-canvas px-1.5 py-0.5 text-[10px] text-muted">{t(`change.${c.changeType}`)}</span>
                <span className="text-muted">{fmt(c.oldAmount)} → <span className="text-ink">{fmt(c.newAmount)}</span></span>
                {c.reason && <span className="text-xs text-muted">· {c.reason}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function LineRow({ employeeId, line, readOnly }: { employeeId: number; line: SalaryLine; readOnly: boolean }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("FIXED");
  const [delta, setDelta] = useState("");
  const [date, setDate] = useState(today());
  const [err, setErr] = useState<string | null>(null);

  const apply = () => {
    setErr(null);
    start(async () => {
      const r = await applyLineChangeAction(employeeId, line.componentId, type, Number(delta), date, null);
      if (!r.ok) { setErr(r.error); return; }
      setDelta(""); setOpen(false); router.refresh();
    });
  };
  const toggle = () => start(async () => { await setLineActiveAction(employeeId, line.id, !line.active); router.refresh(); });

  return (
    <div className={`rounded-lg border border-line px-3 py-2 text-sm ${line.active ? "" : "opacity-60"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          <span className="font-mono text-xs text-muted">{line.code}</span> · {line.name}
          <span className="ms-1 text-xs text-muted">{t(`val.${line.valuation}`)}</span>
          {!line.active && <span className="ms-1 rounded bg-canvas px-1.5 py-0.5 text-[10px] text-muted">{t("salary.inactive")}</span>}
        </span>
        <span className="flex items-center gap-2">
          <span className="font-semibold text-ink">{fmt(line.amount)}</span>
          {!readOnly && <button type="button" className="text-xs text-brand hover:underline" onClick={() => setOpen((o) => !o)}>{t("salary.adjust")}</button>}
        </span>
      </div>
      {!readOnly && open && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select className="input h-8 w-28 py-0 text-xs" value={type} onChange={(e) => setType(e.target.value)}>{CHANGE_TYPES.map((c) => <option key={c} value={c}>{t(`change.${c}`)}</option>)}</select>
          <input className="input h-8 w-24 py-0 text-xs" type="number" step="0.01" placeholder={type === "PERCENT" ? "%" : t("salary.amount")} value={delta} onChange={(e) => setDelta(e.target.value)} />
          <input className="input h-8 w-36 py-0 text-xs" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <button type="button" className="btn-primary px-2 py-1 text-xs" disabled={pending || delta === ""} onClick={apply}>{t("salary.apply")}</button>
          <button type="button" className="text-xs text-muted hover:underline" disabled={pending} onClick={toggle}>{line.active ? t("salary.disable") : t("salary.enable")}</button>
          {err && <span className="text-xs text-red-600">{t(err)}</span>}
        </div>
      )}
    </div>
  );
}

function AddComponent({ employeeId, eligible }: { employeeId: number; eligible: Eligible[] }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [componentId, setComponentId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [err, setErr] = useState<string | null>(null);

  const pick = (id: string) => {
    setComponentId(id);
    const c = eligible.find((e) => String(e.id) === id);
    setAmount(c?.defaultAmount != null ? String(c.defaultAmount) : "");
  };
  const add = () => {
    setErr(null);
    start(async () => {
      const r = await applyLineChangeAction(employeeId, Number(componentId), "SET", Number(amount || 0), date, null);
      if (!r.ok) { setErr(r.error); return; }
      setComponentId(""); setAmount(""); router.refresh();
    });
  };

  return (
    <div className="space-y-2 border-t border-line pt-3">
      <div className="label">{t("salary.addComponent")}</div>
      <div className="flex flex-wrap items-center gap-2">
        <select className="input h-9 w-48 py-0 text-sm" value={componentId} onChange={(e) => pick(e.target.value)}>
          <option value="">{t("salary.component")}</option>
          {eligible.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input className="input h-9 w-28 py-0 text-sm" type="number" step="0.01" placeholder={t("salary.amount")} value={amount} onChange={(e) => setAmount(e.target.value)} />
        <input className="input h-9 w-40 py-0 text-sm" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button type="button" className="btn-secondary px-3 py-1.5 text-sm" disabled={pending || !componentId} onClick={add}>{t("salary.add")}</button>
      </div>
      {err && <p className="text-sm text-red-600">{t(err)}</p>}
    </div>
  );
}
