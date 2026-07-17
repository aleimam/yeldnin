"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { resolveVetoAction } from "./actions";

/** Admin resolves a pending veto: Keep (reject the veto) or Delete (uphold it,
 *  soft-deleting the evaluation). A decision comment is REQUIRED and shared with
 *  the rep — the Keep/Delete buttons stay disabled until one is entered. */
export function VetoResolveActions({ vetoId }: { vetoId: number }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const ready = note.trim().length > 0;

  const resolve = (uphold: boolean) =>
    start(async () => {
      setError(null);
      if (!ready) return;
      if (uphold && !confirm(t("cs.veto.confirmDelete"))) return;
      const res = await resolveVetoAction(vetoId, uphold, note.trim());
      if (res.ok) router.refresh();
      else setError(res.error ?? null);
    });

  return (
    <div className="flex flex-col items-end gap-1">
      {error && <div className="alert alert-error">{error}</div>}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <input
          className="input h-9 w-44 text-sm"
          placeholder={t("cs.veto.resolutionNote")}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          aria-label={t("cs.veto.resolutionNote")}
        />
        <button type="button" onClick={() => resolve(false)} disabled={pending || !ready} className="btn-primary btn-sm disabled:opacity-40">{t("cs.veto.keep")}</button>
        <button type="button" onClick={() => resolve(true)} disabled={pending || !ready} className="btn-secondary btn-sm text-red-600 disabled:opacity-40">{t("cs.veto.delete")}</button>
      </div>
    </div>
  );
}
