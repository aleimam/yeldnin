"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { PhotoUpload, type UploadedPhoto } from "@/components/PhotoUpload";
import { COUNTRIES } from "@/lib/hubs/hubs-logic";
import { createHubAction, saveHubAction, archiveHubAction } from "./actions";

export interface HubInitial {
  id?: number;
  name: string;
  country: string;
  notes: string;
  active: boolean;
  photos: UploadedPhoto[];
}

export function HubForm({ mode, initial }: { mode: "create" | "edit"; initial: HubInitial }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [active, setActive] = useState(initial.active);
  const [photos, setPhotos] = useState<UploadedPhoto[]>(initial.photos);
  const originalIds = new Set(initial.photos.map((p) => p.id));
  const [f, setF] = useState({ name: initial.name, country: initial.country || "USA", notes: initial.notes });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  function submit() {
    setError(null);
    setSaved(false);
    const payload = {
      name: f.name,
      country: f.country,
      notes: f.notes || undefined,
      photoIds: photos.map((p) => p.id).filter((id) => !originalIds.has(id)),
    };
    start(async () => {
      const res = mode === "create" ? await createHubAction(payload) : await saveHubAction({ ...payload, id: initial.id!, active });
      if (res.ok) {
        if (mode === "create") router.push(`/hubs/${res.id}`);
        else { setSaved(true); router.refresh(); }
      } else setError(res.error);
    });
  }
  function archive() {
    if (!confirm(t("hubs.archiveConfirm"))) return;
    start(async () => { await archiveHubAction(initial.id!); router.push("/hubs"); });
  }

  return (
    <div className="card max-w-xl space-y-4 p-6">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {saved && <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{t("hubs.saved")}</div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label">{t("hubs.name")}</label><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} /></div>
        <div>
          <label className="label">{t("hubs.country")}</label>
          <select className="input" value={f.country} onChange={(e) => set("country", e.target.value)}>
            {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div><label className="label">{t("hubs.notes")}</label><textarea className="input" rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></div>
      {mode === "edit" && (
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          {t("hubs.active")}
        </label>
      )}
      <div><label className="label">{t("hubs.photos")}</label><PhotoUpload photos={photos} onChange={setPhotos} /></div>
      <div className="flex items-center gap-4">
        <button onClick={submit} disabled={pending} className="btn-primary">{pending ? "…" : mode === "create" ? t("hubs.create") : t("common.save")}</button>
        {mode === "edit" && <button onClick={archive} disabled={pending} className="text-sm text-red-600 hover:underline disabled:opacity-50">{t("hubs.archive")}</button>}
      </div>
    </div>
  );
}
