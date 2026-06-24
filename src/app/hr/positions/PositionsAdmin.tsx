"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { TrashIcon } from "@/components/icons/TrashIcon";
import { saveDepartmentsAction, savePositionsAction } from "../actions";

type Dept = { id: number; name: string; nameAr: string | null };
type Pos = {
  id: number;
  departmentId: number | null;
  title: string;
  titleAr: string | null;
  grade: string | null;
  description: string | null;
  descriptionAr: string | null;
};
type DeptRow = { id: number; name: string; nameAr: string; remove: boolean };
type PosRow = { id: number; departmentId: string; title: string; titleAr: string; grade: string; description: string; descriptionAr: string; remove: boolean };

export function PositionsAdmin({ departments, positions }: { departments: Dept[]; positions: Pos[] }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const [depts, setDepts] = useState<DeptRow[]>(departments.map((d) => ({ id: d.id, name: d.name, nameAr: d.nameAr ?? "", remove: false })));
  const [newDept, setNewDept] = useState({ name: "", nameAr: "" });

  const [pos, setPos] = useState<PosRow[]>(
    positions.map((p) => ({
      id: p.id, departmentId: p.departmentId ? String(p.departmentId) : "", title: p.title, titleAr: p.titleAr ?? "",
      grade: p.grade ?? "", description: p.description ?? "", descriptionAr: p.descriptionAr ?? "", remove: false,
    })),
  );
  const [newPos, setNewPos] = useState({ departmentId: "", title: "", titleAr: "", grade: "", description: "", descriptionAr: "" });

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setErr(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) { setErr(r.error || "Could not save."); return; }
      router.refresh();
    });
  };

  const saveDepts = () =>
    run(() => saveDepartmentsAction(
      depts.map((d) => ({ id: d.id, remove: d.remove, name: d.name, nameAr: d.nameAr || null })),
      newDept.name.trim() ? { name: newDept.name, nameAr: newDept.nameAr || null } : null,
    ));

  const savePos = () =>
    run(() => savePositionsAction(
      pos.map((p) => ({
        id: p.id, remove: p.remove, departmentId: p.departmentId ? Number(p.departmentId) : null,
        title: p.title, titleAr: p.titleAr || null, grade: p.grade || null, description: p.description || null, descriptionAr: p.descriptionAr || null,
      })),
      newPos.title.trim()
        ? { departmentId: newPos.departmentId ? Number(newPos.departmentId) : null, title: newPos.title, titleAr: newPos.titleAr || null, grade: newPos.grade || null, description: newPos.description || null, descriptionAr: newPos.descriptionAr || null }
        : null,
    ));

  return (
    <div className="max-w-4xl space-y-8">
      {err && <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

      {/* Departments */}
      <div className="card space-y-3 p-5">
        <h2 className="font-semibold text-ink">{t("pos.departments")}</h2>
        {depts.map((d, i) => (
          <div key={d.id} className={`grid grid-cols-[1fr_1fr_auto] items-center gap-3 ${d.remove ? "opacity-40" : ""}`}>
            <input className="input" value={d.name} onChange={(e) => setDepts((s) => s.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            <input className="input" dir="rtl" value={d.nameAr} onChange={(e) => setDepts((s) => s.map((x, j) => (j === i ? { ...x, nameAr: e.target.value } : x)))} />
            <button type="button" className="text-red-600 hover:text-red-700" title={t("common.delete")} aria-label={t("common.delete")} onClick={() => setDepts((s) => s.map((x, j) => (j === i ? { ...x, remove: !x.remove } : x)))}><TrashIcon className="h-4 w-4" /></button>
          </div>
        ))}
        <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-3 border-t border-line pt-3">
          <input className="input" placeholder={`+ ${t("hr.department")}`} value={newDept.name} onChange={(e) => setNewDept((s) => ({ ...s, name: e.target.value }))} />
          <input className="input" dir="rtl" placeholder={t("users.nameAr")} value={newDept.nameAr} onChange={(e) => setNewDept((s) => ({ ...s, nameAr: e.target.value }))} />
          <span />
        </div>
        <button type="button" className="btn-primary btn-sm" disabled={pending} onClick={saveDepts}>{t("hr.save")}</button>
      </div>

      {/* Positions */}
      <div className="card space-y-4 p-5">
        <h2 className="font-semibold text-ink">{t("pos.positions")}</h2>
        {pos.map((p, i) => (
          <div key={p.id} className={`grid gap-2 border-b border-line/60 pb-3 sm:grid-cols-2 ${p.remove ? "opacity-40" : ""}`}>
            <label className="block"><span className="label">{t("hr.jobTitle")}</span><input className="input" value={p.title} onChange={(e) => setPos((s) => s.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} /></label>
            <label className="block"><span className="label">{t("hr.jobTitleAr")}</span><input className="input" dir="rtl" value={p.titleAr} onChange={(e) => setPos((s) => s.map((x, j) => (j === i ? { ...x, titleAr: e.target.value } : x)))} /></label>
            <label className="block"><span className="label">{t("hr.department")}</span>
              <select className="input" value={p.departmentId} onChange={(e) => setPos((s) => s.map((x, j) => (j === i ? { ...x, departmentId: e.target.value } : x)))}>
                <option value="">—</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
            <label className="block"><span className="label">{t("hr.grade")}</span><input className="input" value={p.grade} onChange={(e) => setPos((s) => s.map((x, j) => (j === i ? { ...x, grade: e.target.value } : x)))} /></label>
            <label className="block"><span className="label">{t("hr.description")}</span><input className="input" value={p.description} onChange={(e) => setPos((s) => s.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} /></label>
            <label className="block"><span className="label">{t("hr.descriptionAr")}</span><input className="input" dir="rtl" value={p.descriptionAr} onChange={(e) => setPos((s) => s.map((x, j) => (j === i ? { ...x, descriptionAr: e.target.value } : x)))} /></label>
            <div className="sm:col-span-2">
              <button type="button" className="text-red-600 hover:text-red-700" title={t("common.delete")} aria-label={t("common.delete")} onClick={() => setPos((s) => s.map((x, j) => (j === i ? { ...x, remove: !x.remove } : x)))}><TrashIcon className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
        <div className="grid gap-2 border-t border-line pt-3 sm:grid-cols-2">
          <label className="block"><span className="label">+ {t("hr.jobTitle")}</span><input className="input" value={newPos.title} onChange={(e) => setNewPos((s) => ({ ...s, title: e.target.value }))} /></label>
          <label className="block"><span className="label">{t("hr.jobTitleAr")}</span><input className="input" dir="rtl" value={newPos.titleAr} onChange={(e) => setNewPos((s) => ({ ...s, titleAr: e.target.value }))} /></label>
          <label className="block"><span className="label">{t("hr.department")}</span>
            <select className="input" value={newPos.departmentId} onChange={(e) => setNewPos((s) => ({ ...s, departmentId: e.target.value }))}>
              <option value="">—</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <label className="block"><span className="label">{t("hr.grade")}</span><input className="input" value={newPos.grade} onChange={(e) => setNewPos((s) => ({ ...s, grade: e.target.value }))} /></label>
          <label className="block"><span className="label">{t("hr.description")}</span><input className="input" value={newPos.description} onChange={(e) => setNewPos((s) => ({ ...s, description: e.target.value }))} /></label>
          <label className="block"><span className="label">{t("hr.descriptionAr")}</span><input className="input" dir="rtl" value={newPos.descriptionAr} onChange={(e) => setNewPos((s) => ({ ...s, descriptionAr: e.target.value }))} /></label>
        </div>
        <button type="button" className="btn-primary btn-sm" disabled={pending} onClick={savePos}>{t("hr.save")}</button>
        <p className="text-xs text-muted">{t("pos.hint")}</p>
      </div>
    </div>
  );
}
