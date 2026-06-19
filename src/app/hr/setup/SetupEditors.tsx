"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { createComponentAction, archiveComponentAction, createDayTypeAction, updateDayTypeAction, archiveDayTypeAction, setDutyMappingAction } from "../attendance-actions";

interface Component { id: number; code: string; name: string; kind: string; system: boolean }
interface DayType { id: number; code: string; name: string; nameAr: string | null; dayClass: string; bonusComponentId: number | null; penaltyComponentId: number | null; system: boolean }
interface Mapping { dutyEidDays: string; dutyEidVacation: string; dutyVacation: string; dutyWeekend: string }

export function SetupEditors({ components, dayTypes, mapping }: { components: Component[]; dayTypes: DayType[]; mapping: Mapping }) {
  const dutyTypes = dayTypes.filter((d) => d.dayClass === "DUTY");
  return (
    <div className="space-y-6">
      <ComponentsSection components={components} />
      <DayTypesSection dayTypes={dayTypes} components={components} />
      <MappingSection mapping={mapping} dutyTypes={dutyTypes} />
    </div>
  );
}

function ComponentsSection({ components }: { components: Component[] }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState({ code: "", name: "", nameAr: "", kind: "BONUS", notes: "" });
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));
  const add = () => { setErr(null); start(async () => { const r = await createComponentAction({ code: f.code, name: f.name, nameAr: f.nameAr || null, kind: f.kind, notes: f.notes || null }); if (!r.ok) { setErr(r.error); return; } setF({ code: "", name: "", nameAr: "", kind: "BONUS", notes: "" }); router.refresh(); }); };

  return (
    <div className="card space-y-3 p-5">
      <h2 className="font-semibold text-ink">{t("comp.title")}</h2>
      <div className="grid gap-2 sm:grid-cols-4">
        <input className="input" placeholder={t("comp.code")} value={f.code} onChange={set("code")} />
        <input className="input" placeholder={t("comp.name")} value={f.name} onChange={set("name")} />
        <input className="input" dir="rtl" placeholder={t("comp.nameAr")} value={f.nameAr} onChange={set("nameAr")} />
        <select className="input" value={f.kind} onChange={set("kind")}><option value="BONUS">{t("comp.bonus")}</option><option value="PENALTY">{t("comp.penalty")}</option></select>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button type="button" className="btn-primary px-3 py-1.5 text-sm" disabled={pending || !f.code || !f.name} onClick={add}>{t("comp.add")}</button>
      <ul className="divide-y divide-line text-sm">
        {components.map((c) => (
          <li key={c.id} className="flex items-center justify-between py-1.5">
            <span><span className="font-mono text-xs text-muted">{c.code}</span> · {c.name} <span className={`ms-1 rounded px-1.5 py-0.5 text-[10px] ${c.kind === "BONUS" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{t(`comp.${c.kind === "BONUS" ? "bonus" : "penalty"}`)}</span></span>
            {!c.system && <button type="button" className="text-xs text-red-600 hover:underline" disabled={pending} onClick={() => start(async () => { await archiveComponentAction(c.id); router.refresh(); })}>{t("leave.archive")}</button>}
          </li>
        ))}
        {components.length === 0 && <li className="py-1.5 text-muted">—</li>}
      </ul>
    </div>
  );
}

function DayTypesSection({ dayTypes, components }: { dayTypes: DayType[]; components: Component[] }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState({ code: "", name: "", nameAr: "", dayClass: "DUTY" });
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));
  const add = () => { setErr(null); start(async () => { const r = await createDayTypeAction({ code: f.code, name: f.name, nameAr: f.nameAr || null, dayClass: f.dayClass }); if (!r.ok) { setErr(r.error); return; } setF({ code: "", name: "", nameAr: "", dayClass: "DUTY" }); router.refresh(); }); };

  return (
    <div className="card space-y-3 p-5">
      <h2 className="font-semibold text-ink">{t("daytype.title")}</h2>
      <div className="grid gap-2 sm:grid-cols-4">
        <input className="input" placeholder={t("comp.code")} value={f.code} onChange={set("code")} />
        <input className="input" placeholder={t("comp.name")} value={f.name} onChange={set("name")} />
        <input className="input" dir="rtl" placeholder={t("comp.nameAr")} value={f.nameAr} onChange={set("nameAr")} />
        <select className="input" value={f.dayClass} onChange={set("dayClass")}><option value="LEAVE">{t("daytype.leave")}</option><option value="DUTY">{t("daytype.duty")}</option></select>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button type="button" className="btn-primary px-3 py-1.5 text-sm" disabled={pending || !f.code || !f.name} onClick={add}>{t("daytype.add")}</button>
      <div className="space-y-2">
        {dayTypes.map((d) => <DayTypeRow key={d.id} d={d} components={components} pending={pending} start={start} router={router} />)}
      </div>
    </div>
  );
}

function DayTypeRow({ d, components, pending, start, router }: { d: DayType; components: Component[]; pending: boolean; start: (fn: () => void) => void; router: ReturnType<typeof useRouter> }) {
  const t = useT();
  const [bonus, setBonus] = useState(d.bonusComponentId ? String(d.bonusComponentId) : "");
  const [penalty, setPenalty] = useState(d.penaltyComponentId ? String(d.penaltyComponentId) : "");
  const bonuses = components.filter((c) => c.kind === "BONUS");
  const penalties = components.filter((c) => c.kind === "PENALTY");
  const save = () => start(async () => { await updateDayTypeAction(d.id, { name: d.name, nameAr: d.nameAr, dayClass: d.dayClass, bonusComponentId: bonus ? Number(bonus) : null, penaltyComponentId: penalty ? Number(penalty) : null }); router.refresh(); });

  return (
    <div className="rounded-lg border border-line p-3 text-sm">
      <div className="flex items-center justify-between">
        <span><span className="font-mono text-xs text-muted">{d.code}</span> · {d.name} <span className="ms-1 rounded bg-canvas px-1.5 py-0.5 text-[10px] text-muted">{t(`daytype.${d.dayClass === "LEAVE" ? "leave" : "duty"}`)}</span></span>
        {!d.system && <button type="button" className="text-xs text-red-600 hover:underline" disabled={pending} onClick={() => start(async () => { await archiveDayTypeAction(d.id); router.refresh(); })}>{t("leave.archive")}</button>}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select className="input h-8 w-40 py-0 text-xs" value={bonus} onChange={(e) => setBonus(e.target.value)}><option value="">{t("daytype.noBonus")}</option>{bonuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select className="input h-8 w-40 py-0 text-xs" value={penalty} onChange={(e) => setPenalty(e.target.value)}><option value="">{t("daytype.noPenalty")}</option>{penalties.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <button type="button" className="btn-secondary px-2 py-1 text-xs" disabled={pending} onClick={save}>{t("hr.save")}</button>
      </div>
    </div>
  );
}

function MappingSection({ mapping, dutyTypes }: { mapping: Mapping; dutyTypes: DayType[] }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [m, setM] = useState(mapping);
  const [ok, setOk] = useState(false);
  const set = (k: keyof Mapping) => (e: { target: { value: string } }) => { setM((s) => ({ ...s, [k]: e.target.value })); setOk(false); };
  const sel = (k: keyof Mapping) => (
    <select className="input w-40" value={m[k]} onChange={set(k)}>{dutyTypes.map((d) => <option key={d.code} value={d.code}>{d.code} · {d.name}</option>)}</select>
  );
  const save = () => start(async () => { await setDutyMappingAction(m.dutyEidDays, m.dutyEidVacation, m.dutyVacation, m.dutyWeekend); setOk(true); router.refresh(); });

  return (
    <div className="card space-y-3 p-5">
      <h2 className="font-semibold text-ink">{t("daytype.mapping")}</h2>
      <p className="text-sm text-muted">{t("daytype.mappingDesc")}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex items-center justify-between gap-2"><span>{t("leave.eidDays")}</span>{sel("dutyEidDays")}</label>
        <label className="flex items-center justify-between gap-2"><span>{t("leave.eidVacation")}</span>{sel("dutyEidVacation")}</label>
        <label className="flex items-center justify-between gap-2"><span>{t("leave.vacation")}</span>{sel("dutyVacation")}</label>
        <label className="flex items-center justify-between gap-2"><span>{t("leave.weekend")}</span>{sel("dutyWeekend")}</label>
      </div>
      {ok && <p className="text-sm text-green-600">{t("common.saved")}</p>}
      <button type="button" className="btn-primary px-3 py-1.5 text-sm" disabled={pending} onClick={save}>{t("hr.save")}</button>
    </div>
  );
}
