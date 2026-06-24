"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { castVetoAction } from "./actions";

/** A rep disputes ("vetoes") an approved evaluation of themselves, with a required
 *  note. Disabled when they have no vetoes left this month. */
export function VetoButton({ evaluationId, remaining }: { evaluationId: number; remaining: number }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () =>
    start(async () => {
      setError(null);
      const res = await castVetoAction(evaluationId, note.trim());
      if (res.ok) { setOpen(false); setNote(""); router.refresh(); }
      else setError(res.error ?? null);
    });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={remaining <= 0}
        title={remaining <= 0 ? t("cs.veto.noneLeft") : undefined}
        className="btn-secondary btn-sm text-red-600 disabled:opacity-40"
      >
        🚩 {t("cs.veto.veto")}
      </button>
    );
  }
  return (
    <div className="space-y-2 text-start">
      {error && <div className="alert alert-error">{error}</div>}
      <input
        className="input"
        placeholder={t("cs.veto.notePlaceholder")}
        value={note}
        autoFocus
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
      />
      <div className="flex gap-2">
        <button type="button" onClick={submit} disabled={pending || !note.trim()} className="btn-primary btn-sm">{t("cs.veto.confirm")}</button>
        <button type="button" onClick={() => { setOpen(false); setError(null); }} disabled={pending} className="btn-secondary btn-sm">{t("common.cancel")}</button>
      </div>
    </div>
  );
}
