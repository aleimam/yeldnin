"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { PhotoUpload, type UploadedPhoto } from "@/components/PhotoUpload";
import { DateField } from "@/components/DateField";
import { EMPLOYEE_PHOTO_KINDS } from "@/lib/hr/hr-logic";
import { updateEmployeeAction, updateEmployeeIdentityAction, setLineManagerAction, addNoteAction, addEmployeePhotoAction } from "./actions";

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

interface Identity {
  name: string;
  nameAr: string;
  fullName: string;
  fullNameAr: string;
  email: string;
  uid: string;
  primaryPhone: string;
  secondaryPhone: string;
  yeldnPhone: string;
  positionId: string;
}

export function EmployeeManage({
  employeeId,
  managers,
  initial,
  identity,
  positions,
}: {
  employeeId: number;
  managers: { id: number; label: string }[];
  initial: Initial;
  identity: Identity;
  positions: { id: number; label: string }[];
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const refresh = (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh(); });

  const [d, setD] = useState(initial);
  const setField = (k: keyof Initial) => (e: { target: { value: string } }) => setD((s) => ({ ...s, [k]: e.target.value }));

  // Identity (lives on the linked User — single source of truth) + position.
  const [idf, setIdf] = useState(identity);
  const setId = (k: keyof Identity) => (e: { target: { value: string } }) => setIdf((s) => ({ ...s, [k]: e.target.value }));
  const [idErr, setIdErr] = useState<string | null>(null);

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

      {/* Identity & position — written back to the linked User */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted">{t("hr.identity")}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block"><span className="label">{t("users.name")}</span><input className="input" value={idf.name} onChange={setId("name")} /></label>
          <label className="block"><span className="label">{t("users.nameAr")}</span><input className="input" dir="rtl" value={idf.nameAr} onChange={setId("nameAr")} /></label>
          <label className="block"><span className="label">{t("users.fullName")}</span><input className="input" value={idf.fullName} onChange={setId("fullName")} /></label>
          <label className="block"><span className="label">{t("users.fullNameAr")}</span><input className="input" dir="rtl" value={idf.fullNameAr} onChange={setId("fullNameAr")} /></label>
          <label className="block"><span className="label">{t("users.email")}</span><input className="input" type="email" value={idf.email} onChange={setId("email")} /></label>
          <label className="block"><span className="label">{t("hr.uid")}</span><input className="input" placeholder="YE1101" value={idf.uid} onChange={setId("uid")} /></label>
          <label className="block"><span className="label">{t("users.primaryPhone")}</span><input className="input" value={idf.primaryPhone} onChange={setId("primaryPhone")} /></label>
          <label className="block"><span className="label">{t("users.secondaryPhone")}</span><input className="input" value={idf.secondaryPhone} onChange={setId("secondaryPhone")} /></label>
          <label className="block"><span className="label">{t("users.yeldnPhone")}</span><input className="input" value={idf.yeldnPhone} onChange={setId("yeldnPhone")} /></label>
          <label className="block">
            <span className="label">{t("hr.position")}</span>
            <select className="input" value={idf.positionId} onChange={setId("positionId")}>
              <option value="">{t("hr.noPosition")}</option>
              {positions.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </label>
        </div>
        {idErr && <p className="text-sm text-red-600">{idErr}</p>}
        <button type="button" className="btn-primary px-3 py-1.5 text-sm" disabled={pending} onClick={() => {
          setIdErr(null);
          start(async () => {
            const r = await updateEmployeeIdentityAction(employeeId, {
              name: idf.name, nameAr: idf.nameAr || null, fullName: idf.fullName || null, fullNameAr: idf.fullNameAr || null,
              email: idf.email, uid: idf.uid || null,
              primaryPhone: idf.primaryPhone || null, secondaryPhone: idf.secondaryPhone || null, yeldnPhone: idf.yeldnPhone || null,
              positionId: idf.positionId ? Number(idf.positionId) : null,
            });
            if (!r.ok) { setIdErr(r.error); return; }
            router.refresh();
          });
        }}>{t("hr.save")}</button>
      </div>

      <div className="space-y-3 border-t border-line pt-4">
        <h3 className="text-sm font-medium text-muted">{t("hr.editDetails")}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block"><span className="label">{t("hr.nationalId")}</span><input className="input" value={d.nationalIdNumber} onChange={setField("nationalIdNumber")} /></label>
          <label className="block"><span className="label">{t("hr.idExpiry")}</span><DateField className="input" value={d.nationalIdExpiry} onChange={setField("nationalIdExpiry")} /></label>
          <label className="block"><span className="label">{t("hr.degree")}</span><input className="input" value={d.gradDegree} onChange={setField("gradDegree")} /></label>
          <label className="block"><span className="label">{t("hr.university")}</span><input className="input" value={d.gradUniversity} onChange={setField("gradUniversity")} /></label>
          <label className="block"><span className="label">{t("hr.faculty")}</span><input className="input" value={d.gradFaculty} onChange={setField("gradFaculty")} /></label>
          <label className="block"><span className="label">{t("hr.birthDate")}</span><DateField className="input" value={d.birthDate} onChange={setField("birthDate")} /></label>
          <label className="block"><span className="label">{t("hr.hiringDate")}</span><DateField className="input" value={d.hiringDate} onChange={setField("hiringDate")} /></label>
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
