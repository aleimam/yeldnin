"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { TrashIcon } from "@/components/icons/TrashIcon";
import { savePositionsAction } from "../actions";

type Pos = {
  id: number;
  title: string;
  titleAr: string | null;
  grade: string | null;
  gradeLevel: number | null;
  description: string | null;
  descriptionAr: string | null;
};
type PosRow = { id: number; title: string; titleAr: string; grade: string; gradeLevel: string; description: string; descriptionAr: string; remove: boolean };

export function PositionsAdmin({ positions }: { positions: Pos[] }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const [pos, setPos] = useState<PosRow[]>(
    positions.map((p) => ({
      id: p.id, title: p.title, titleAr: p.titleAr ?? "",
      grade: p.grade ?? "", gradeLevel: p.gradeLevel != null ? String(p.gradeLevel) : "",
      description: p.description ?? "", descriptionAr: p.descriptionAr ?? "", remove: false,
    })),
  );
  const [newPos, setNewPos] = useState({ title: "", titleAr: "", grade: "", gradeLevel: "", description: "", descriptionAr: "" });
  const num = (v: string) => (v.trim() && Number.isFinite(Number(v)) ? Number(v) : null);

  const savePos = () => {
    setErr(null);
    start(async () => {
      const r = await savePositionsAction(
        pos.map((p) => ({
          id: p.id, remove: p.remove,
          title: p.title, titleAr: p.titleAr || null, grade: p.grade || null, gradeLevel: num(p.gradeLevel), description: p.description || null, descriptionAr: p.descriptionAr || null,
        })),
        newPos.title.trim()
          ? { title: newPos.title, titleAr: newPos.titleAr || null, grade: newPos.grade || null, gradeLevel: num(newPos.gradeLevel), description: newPos.description || null, descriptionAr: newPos.descriptionAr || null }
          : null,
      );
      if (!r.ok) { setErr(r.error || "Could not save."); return; }
      router.refresh();
    });
  };

  return (
    <div className="max-w-4xl space-y-8">
      {err && <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

      <div className="card space-y-4 p-5">
        <h2 className="font-semibold text-ink">{t("pos.positions")}</h2>
        {pos.map((p, i) => (
          <div key={p.id} className={`grid gap-2 border-b border-line/60 pb-3 sm:grid-cols-2 ${p.remove ? "opacity-40" : ""}`}>
            <label className="block"><span className="label">{t("hr.jobTitle")}</span><input className="input" value={p.title} onChange={(e) => setPos((s) => s.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} /></label>
            <label className="block"><span className="label">{t("hr.jobTitleAr")}</span><input className="input" dir="rtl" value={p.titleAr} onChange={(e) => setPos((s) => s.map((x, j) => (j === i ? { ...x, titleAr: e.target.value } : x)))} /></label>
            <label className="block"><span className="label">{t("hr.grade")}</span><input className="input" value={p.grade} onChange={(e) => setPos((s) => s.map((x, j) => (j === i ? { ...x, grade: e.target.value } : x)))} /></label>
            <label className="block"><span className="label">{t("hr.gradeLevel")}</span><input className="input" inputMode="numeric" placeholder={t("hr.gradeLevelHint")} value={p.gradeLevel} onChange={(e) => setPos((s) => s.map((x, j) => (j === i ? { ...x, gradeLevel: e.target.value } : x)))} /></label>
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
          <label className="block"><span className="label">{t("hr.grade")}</span><input className="input" value={newPos.grade} onChange={(e) => setNewPos((s) => ({ ...s, grade: e.target.value }))} /></label>
          <label className="block"><span className="label">{t("hr.gradeLevel")}</span><input className="input" inputMode="numeric" placeholder={t("hr.gradeLevelHint")} value={newPos.gradeLevel} onChange={(e) => setNewPos((s) => ({ ...s, gradeLevel: e.target.value }))} /></label>
          <label className="block"><span className="label">{t("hr.description")}</span><input className="input" value={newPos.description} onChange={(e) => setNewPos((s) => ({ ...s, description: e.target.value }))} /></label>
          <label className="block"><span className="label">{t("hr.descriptionAr")}</span><input className="input" dir="rtl" value={newPos.descriptionAr} onChange={(e) => setNewPos((s) => ({ ...s, descriptionAr: e.target.value }))} /></label>
        </div>
        <button type="button" className="btn-primary btn-sm" disabled={pending} onClick={savePos}>{t("hr.save")}</button>
      </div>
    </div>
  );
}
