"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { PhotoUpload, type UploadedPhoto } from "@/components/PhotoUpload";
import { Toggle } from "@/components/Toggle";
import { AutoTextarea } from "@/components/AutoTextarea";
import { PRODUCT_TYPES } from "@/lib/products/products-logic";
import { createTravelerAction, saveTravelerAction, archiveTravelerAction } from "./actions";

export interface TravelerInitial {
  id?: number;
  name: string;
  contact: string;
  notes: string;
  referenceTravelerId: string;
  blacklisted: boolean;
  staticAddress: boolean;
  carriesMaleSupport: boolean;
  allowedProductTypes: string[];
  active: boolean;
  photos: UploadedPhoto[];
}

export function TravelerForm({
  mode,
  initial,
  travelers,
}: {
  mode: "create" | "edit";
  initial: TravelerInitial;
  travelers: { id: number; name: string }[];
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [active, setActive] = useState(initial.active);
  const [photos, setPhotos] = useState<UploadedPhoto[]>(initial.photos);
  const originalIds = new Set(initial.photos.map((p) => p.id));
  const [types, setTypes] = useState<string[]>(initial.allowedProductTypes);
  const [f, setF] = useState({
    name: initial.name,
    contact: initial.contact,
    notes: initial.notes,
    referenceTravelerId: initial.referenceTravelerId,
    blacklisted: initial.blacklisted,
    staticAddress: initial.staticAddress,
    carriesMaleSupport: initial.carriesMaleSupport,
  });
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  const toggleType = (ty: string) => setTypes((p) => (p.includes(ty) ? p.filter((x) => x !== ty) : [...p, ty]));

  function submit() {
    setError(null);
    setSaved(false);
    const payload = {
      name: f.name,
      contact: f.contact || undefined,
      notes: f.notes || undefined,
      referenceTravelerId: f.referenceTravelerId ? Number(f.referenceTravelerId) : null,
      blacklisted: f.blacklisted,
      staticAddress: f.staticAddress,
      carriesMaleSupport: f.carriesMaleSupport,
      allowedProductTypes: types,
      photoIds: photos.map((p) => p.id).filter((id) => !originalIds.has(id)),
    };
    start(async () => {
      const res = mode === "create" ? await createTravelerAction(payload) : await saveTravelerAction({ ...payload, id: initial.id!, active });
      if (res.ok) {
        if (mode === "create") router.push(`/travelers/${res.id}`);
        else { setSaved(true); router.refresh(); }
      } else setError(res.error);
    });
  }
  function archive() {
    if (!confirm(t("travelers.archiveConfirm"))) return;
    start(async () => { await archiveTravelerAction(initial.id!); router.push("/travelers"); });
  }

  return (
    <div className="card max-w-2xl space-y-4 p-6">
      {error && <div className="alert alert-error">{error}</div>}
      {saved && <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{t("travelers.saved")}</div>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label">{t("travelers.name")}</label><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} /></div>
        <div><label className="label">{t("travelers.contact")}</label><input className="input" value={f.contact} onChange={(e) => set("contact", e.target.value)} /></div>
        <div>
          <label className="label">{t("travelers.reference")}</label>
          <select className="input" value={f.referenceTravelerId} onChange={(e) => set("referenceTravelerId", e.target.value)}>
            <option value="">{t("pricer.f.choose")}</option>
            {travelers.map((tr) => <option key={tr.id} value={tr.id}>{tr.name}</option>)}
          </select>
        </div>
      </div>

      <div><label className="label">{t("travelers.notes")}</label><AutoTextarea value={f.notes} onChange={(e) => set("notes", e.target.value)} /></div>

      <div>
        <label className="label">{t("travelers.allowedTypes")}</label>
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-1.5 text-sm font-medium text-ink">
            <input
              type="checkbox"
              checked={types.length === PRODUCT_TYPES.length}
              onChange={(e) => setTypes(e.target.checked ? [...PRODUCT_TYPES] : [])}
            />
            {t("common.selectAll")}
          </label>
          {PRODUCT_TYPES.map((ty) => (
            <label key={ty} className="flex items-center gap-1.5 text-sm text-ink">
              <input type="checkbox" checked={types.includes(ty)} onChange={() => toggleType(ty)} />
              {t(`ptype.${ty}`)}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <Toggle checked={f.carriesMaleSupport} onChange={(v) => set("carriesMaleSupport", v)} label={t("travelers.maleSupport")} />
        <Toggle checked={f.staticAddress} onChange={(v) => set("staticAddress", v)} label={t("travelers.staticAddress")} />
        <Toggle checked={f.blacklisted} onChange={(v) => set("blacklisted", v)} label={t("travelers.blacklisted")} />
        {mode === "edit" && (
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            {t("travelers.active")}
          </label>
        )}
      </div>

      <div><label className="label">{t("travelers.photos")}</label><PhotoUpload photos={photos} onChange={setPhotos} /></div>

      <div className="flex items-center gap-4">
        <button onClick={submit} disabled={pending} className="btn-primary">{pending ? "…" : mode === "create" ? t("travelers.create") : t("common.save")}</button>
        {mode === "edit" && <button onClick={archive} disabled={pending} className="text-sm text-red-600 hover:underline disabled:opacity-50">{t("travelers.archive")}</button>}
      </div>
    </div>
  );
}
