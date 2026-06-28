"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { createEventAction } from "../engagement-actions";

/** Create an engagement event from a template + pay-month, then open it. */
export function NewEventForm({ templates, defaultMonth }: { templates: { id: number; label: string }[]; defaultMonth: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState({ templateId: "", month: defaultMonth, title: "" });
  const [err, setErr] = useState<string | null>(null);

  const create = () => {
    setErr(null);
    const [y, m] = f.month.split("-");
    start(async () => {
      const r = await createEventAction({ templateId: Number(f.templateId), year: Number(y), month: Number(m), title: f.title || null });
      if (!r.ok) { setErr(r.error); return; }
      router.push(`/hr/engagement/${r.id}`);
    });
  };

  return (
    <div className="card space-y-3 p-5">
      <h2 className="font-semibold text-ink">{t("eng.newEvent")}</h2>
      {templates.length === 0 ? (
        <p className="text-sm text-muted">{t("eng.noTemplates")}</p>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            <select className="input" value={f.templateId} onChange={(e) => setF((s) => ({ ...s, templateId: e.target.value }))}>
              <option value="">{t("eng.template")}</option>
              {templates.map((tpl) => <option key={tpl.id} value={tpl.id}>{tpl.label}</option>)}
            </select>
            <label className="block"><span className="label">{t("eng.payMonth")}</span><input className="input" type="month" value={f.month} onChange={(e) => setF((s) => ({ ...s, month: e.target.value }))} /></label>
            <input className="input self-end" placeholder={t("eng.titleOptional")} value={f.title} onChange={(e) => setF((s) => ({ ...s, title: e.target.value }))} />
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button type="button" className="btn-primary px-3 py-1.5 text-sm" disabled={pending || !f.templateId} onClick={create}>{t("eng.createEvent")}</button>
        </>
      )}
    </div>
  );
}
