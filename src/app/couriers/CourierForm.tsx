"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { createCourierAction, saveCourierAction, archiveCourierAction } from "./actions";

export interface CourierInitial {
  id?: number;
  name: string;
  contact: string;
  active: boolean;
}

export function CourierForm({ mode, initial }: { mode: "create" | "edit"; initial: CourierInitial }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [active, setActive] = useState(initial.active);
  const [f, setF] = useState({ name: initial.name, contact: initial.contact });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  function submit() {
    setError(null);
    setSaved(false);
    const payload = { name: f.name, contact: f.contact || undefined };
    start(async () => {
      const res = mode === "create" ? await createCourierAction(payload) : await saveCourierAction({ ...payload, id: initial.id!, active });
      if (res.ok) {
        if (mode === "create") router.push(`/couriers/${res.id}`);
        else { setSaved(true); router.refresh(); }
      } else setError(res.error);
    });
  }
  function archive() {
    if (!confirm(t("couriers.archiveConfirm"))) return;
    start(async () => { await archiveCourierAction(initial.id!); router.push("/couriers"); });
  }

  return (
    <div className="card max-w-xl space-y-4 p-6">
      {error && <div className="alert alert-error">{error}</div>}
      {saved && <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{t("couriers.saved")}</div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label">{t("couriers.name")}</label><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} /></div>
        <div><label className="label">{t("couriers.contact")}</label><input className="input" value={f.contact} onChange={(e) => set("contact", e.target.value)} /></div>
      </div>
      {mode === "edit" && (
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          {t("couriers.active")}
        </label>
      )}
      <div className="flex items-center gap-4">
        <button onClick={submit} disabled={pending} className="btn-primary">{pending ? "…" : mode === "create" ? t("couriers.create") : t("common.save")}</button>
        {mode === "edit" && <button onClick={archive} disabled={pending} className="text-sm text-red-600 hover:underline disabled:opacity-50">{t("couriers.archive")}</button>}
      </div>
    </div>
  );
}
