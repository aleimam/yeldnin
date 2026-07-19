"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { AutoTextarea } from "@/components/AutoTextarea";
import { CONTACT_CHANNELS } from "@/lib/customers/customers-logic";
import { createCustomerAction, saveCustomerAction, archiveCustomerAction } from "./actions";

export interface CustomerInitial {
  id?: number;
  name: string;
  scope: string;
  contactChannel: string;
  contactNumber: string;
  notes: string;
  active: boolean;
}

export function CustomerForm({
  mode,
  initial,
  allowedScopes,
}: {
  mode: "create" | "edit";
  initial: CustomerInitial;
  allowedScopes: string[];
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [active, setActive] = useState(initial.active);
  const [f, setF] = useState({
    name: initial.name,
    scope: initial.scope || allowedScopes[0] || "VEEEY",
    contactChannel: initial.contactChannel || "WHATSAPP",
    contactNumber: initial.contactNumber,
    notes: initial.notes,
  });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  function submit() {
    setError(null);
    setSaved(false);
    const payload = { name: f.name, scope: f.scope, contactChannel: f.contactChannel, contactNumber: f.contactNumber || undefined, notes: f.notes || undefined };
    start(async () => {
      const res = mode === "create" ? await createCustomerAction(payload) : await saveCustomerAction({ ...payload, id: initial.id!, active });
      if (res.ok) {
        if (mode === "create") router.push(`/customers/${res.id}`);
        else { setSaved(true); router.refresh(); }
      } else setError(res.error);
    });
  }
  function archive() {
    if (!confirm(t("customers.archiveConfirm"))) return;
    start(async () => { await archiveCustomerAction(initial.id!); router.push("/customers"); });
  }

  return (
    <div className="card max-w-xl space-y-4 p-6">
      {error && <div className="alert alert-error">{error}</div>}
      {saved && <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{t("customers.saved")}</div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label">{t("customers.name")}</label><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} /></div>
        <div>
          <label className="label">{t("requests.scope")}</label>
          <select className="input" value={f.scope} onChange={(e) => set("scope", e.target.value)} disabled={allowedScopes.length <= 1}>
            {allowedScopes.map((s) => <option key={s} value={s}>{t(`scope.${s}`)}</option>)}
          </select>
        </div>
        <div>
          <label className="label">{t("customers.channel")}</label>
          <select className="input" value={f.contactChannel} onChange={(e) => set("contactChannel", e.target.value)}>
            {CONTACT_CHANNELS.map((c) => <option key={c} value={c}>{t(`channel.${c}`)}</option>)}
          </select>
        </div>
        <div><label className="label">{t("customers.number")}</label><input className="input" value={f.contactNumber} onChange={(e) => set("contactNumber", e.target.value)} /></div>
        {mode === "edit" && (
          <label className="flex items-end gap-2 pb-2 text-sm text-ink">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            {t("customers.active")}
          </label>
        )}
      </div>
      <div><label className="label">{t("customers.notes")}</label><AutoTextarea value={f.notes} onChange={(e) => set("notes", e.target.value)} /></div>
      <div className="flex items-center gap-4">
        <button onClick={submit} disabled={pending} className="btn-primary">{pending ? "…" : mode === "create" ? t("customers.create") : t("common.save")}</button>
        {mode === "edit" && <button onClick={archive} disabled={pending} className="text-sm text-red-600 hover:underline disabled:opacity-50">{t("customers.archive")}</button>}
      </div>
    </div>
  );
}
