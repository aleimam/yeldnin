"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { resolveVetoAction } from "./actions";

/** Admin resolves a pending veto: Keep (reject the veto) or Delete (uphold it,
 *  soft-deleting the evaluation). An optional resolution note is shared with the rep. */
export function VetoResolveActions({ vetoId }: { vetoId: number }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");

  const resolve = (uphold: boolean) =>
    start(async () => {
      if (uphold && !confirm(t("cs.veto.confirmDelete"))) return;
      await resolveVetoAction(vetoId, uphold, note.trim() || null);
      router.refresh();
    });

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <input
        className="input h-9 w-44 text-sm"
        placeholder={t("cs.veto.resolutionNote")}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <button type="button" onClick={() => resolve(false)} disabled={pending} className="btn-primary btn-sm">{t("cs.veto.keep")}</button>
      <button type="button" onClick={() => resolve(true)} disabled={pending} className="btn-secondary btn-sm text-red-600">{t("cs.veto.delete")}</button>
    </div>
  );
}
