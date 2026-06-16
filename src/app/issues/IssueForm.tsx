"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { PhotoUpload, type UploadedPhoto } from "@/components/PhotoUpload";
import { createIssueAction } from "./actions";

export function IssueForm() {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);

  function submit() {
    setError(null);
    start(async () => {
      const res = await createIssueAction({ title, note: note || undefined, photoIds: photos.map((p) => p.id) });
      if (res.ok) router.push(`/issues/${res.id}`);
      else setError(res.error);
    });
  }

  return (
    <div className="card max-w-xl space-y-4 p-6">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div><label className="label">{t("issues.titleField")}</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div><label className="label">{t("issues.note")}</label><textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></div>
      <div><label className="label">{t("issues.photos")}</label><PhotoUpload photos={photos} onChange={setPhotos} /></div>
      <button onClick={submit} disabled={pending} className="btn-primary">{pending ? "…" : t("issues.create")}</button>
    </div>
  );
}
