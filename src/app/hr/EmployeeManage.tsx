"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { PhotoUpload, type UploadedPhoto } from "@/components/PhotoUpload";
import { EMPLOYEE_PHOTO_KINDS } from "@/lib/hr/hr-logic";
import { updateEmployeeAction, setLineManagerAction, addNoteAction, addEmployeePhotoAction } from "./actions";

interface Initial {
  nationalIdNumber: string;
  nationalIdExpiry: string;
  gradDegree: string;
  gradUniversity: string;
  gradFaculty: string;
  birthDate: string;
  hiringDate: string;
  notes: string;
  lineManagerId: string;
}

export function EmployeeManage({ employeeId, managers, initial }: { employeeId: number; managers: { id: number; label: string }[]; initial: Initial }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const refresh = (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh(); });

  const [d, setD] = useState(initial);
  const setField = (k: keyof Initial) => (e: { target: { value: string } }) => setD((s) => ({ ...s, [k]: e.target.value }));

  const [mgr, setMgr] = useState(initial.lineManagerId);
  const [mgrErr, setMgrErr] = useState<string | null>(null);

  const [note, setNote] = useState("");
  const [notePhotos, setNotePhotos] = useState<UploadedPhoto[]>([]);

  const [docKind, setDocKind] = useState<string>("ID_FRONT");
  const [docLabel, setDocLabel] = useState("");
  const [docPhotos, setDocPhotos] = useState<UploadedPhoto[]>([]);

  return (
    <div className="card space-y-6 border-brand/30 p-5">
      <h2 className="font-semibold text-ink">{t("hr.manage")}</h2>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted">{t("hr.editDetails")}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block"><span className="label">{t("hr.nationalId")}</span><input className="input" value={d.nationalIdNumber} onChange={setField("nationalIdNumber")} /></label>
          <label className="block"><span className="label">{t("hr.idExpiry")}</span><input className="input" type="date" value={d.nationalIdExpiry} onChange={setField("nationalIdExpiry")} /></label>
          <label className="block"><span className="label">{t("hr.degree")}</span><input className="input" value={d.gradDegree} onChange={setField("gradDegree")} /></label>
          <label className="block"><span className="label">{t("hr.university")}</span><input className="input" value={d.gradUniversity} onChange={setField("gradUniversity")} /></label>
          <label className="block"><span className="label">{t("hr.faculty")}</span><input className="input" value={d.gradFaculty} onChange={setField("gradFaculty")} /></label>
          <label className="block"><span className="label">{t("hr.birthDate")}</span><input className="input" type="date" value={d.birthDate} onChange={setField("birthDate")} /></label>
          <label className="block"><span className="label">{t("hr.hiringDate")}</span><input className="input" type="date" value={d.hiringDate} onChange={setField("hiringDate")} /></label>
        </div>
        <label className="block"><span className="label">{t("hr.notes")}</span><textarea className="input" rows={2} value={d.notes} onChange={setField("notes")} /></label>
        <button type="button" className="btn-primary px-3 py-1.5 text-sm" disabled={pending} onClick={() => refresh(() => updateEmployeeAction(employeeId, {
          nationalIdNumber: d.nationalIdNumber || null, nationalIdExpiry: d.nationalIdExpiry || null,
          gradDegree: d.gradDegree || null, gradUniversity: d.gradUniversity || null, gradFaculty: d.gradFaculty || null,
          birthDate: d.birthDate || null, hiringDate: d.hiringDate || null, notes: d.notes || null,
        }))}>{t("hr.save")}</button>
      </div>

      <div className="space-y-2 border-t border-line pt-4">
        <h3 className="text-sm font-medium text-muted">{t("hr.setManager")}</h3>
        <div className="flex items-center gap-2">
          <select className="input w-64" value={mgr} onChange={(e) => setMgr(e.target.value)}>
            <option value="">—</option>
            {managers.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          <button type="button" className="btn-secondary px-3 py-1.5 text-sm" disabled={pending} onClick={() => { setMgrErr(null); start(async () => { const r = await setLineManagerAction(employeeId, mgr ? Number(mgr) : null); if (!r.ok) { setMgrErr(r.error || null); return; } router.refresh(); }); }}>{t("hr.save")}</button>
        </div>
        {mgrErr && <p className="text-sm text-red-600">{mgrErr}</p>}
      </div>

      <div className="space-y-2 border-t border-line pt-4">
        <h3 className="text-sm font-medium text-muted">{t("hr.addNote")}</h3>
        <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        <PhotoUpload photos={notePhotos} onChange={setNotePhotos} />
        <button type="button" className="btn-secondary px-3 py-1.5 text-sm" disabled={pending || !note.trim()} onClick={() => refresh(async () => { await addNoteAction(employeeId, note, notePhotos.map((p) => p.id)); setNote(""); setNotePhotos([]); })}>{t("hr.addNote")}</button>
      </div>

      <div className="space-y-2 border-t border-line pt-4">
        <h3 className="text-sm font-medium text-muted">{t("hr.uploadDoc")}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <select className="input w-48" value={docKind} onChange={(e) => setDocKind(e.target.value)}>
            {EMPLOYEE_PHOTO_KINDS.map((k) => <option key={k} value={k}>{t(`hr.photoKind.${k}`)}</option>)}
          </select>
          <input className="input w-48" placeholder={t("hr.docLabel")} value={docLabel} onChange={(e) => setDocLabel(e.target.value)} />
        </div>
        <PhotoUpload photos={docPhotos} onChange={setDocPhotos} />
        <button type="button" className="btn-secondary px-3 py-1.5 text-sm" disabled={pending || docPhotos.length === 0} onClick={() => refresh(async () => { for (const p of docPhotos) await addEmployeePhotoAction(employeeId, docKind, p.id, docLabel || null); setDocPhotos([]); setDocLabel(""); })}>{t("hr.uploadDoc")}</button>
      </div>
    </div>
  );
}
