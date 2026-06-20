"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { flagTransactionAction, clearFlagAction } from "./actions";

/** Admin/manager review-flag controls (Red/Yellow + optional note). Operate users
 *  see the flag banner but never render this component. */
export function FlagControls({ id, current, currentNote }: { id: number; current: string | null; currentNote: string | null }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState(currentNote ?? "");
  const [err, setErr] = useState<string | null>(null);

  const setFlag = (flag: string) =>
    start(async () => {
      setErr(null);
      const res = await flagTransactionAction(id, flag, note || null);
      if (!res.ok) { setErr(res.error); return; }
      router.refresh();
    });
  const clear = () =>
    start(async () => {
      setErr(null);
      const res = await clearFlagAction(id);
      if (!res.ok) { setErr(res.error); return; }
      router.refresh();
    });

  return (
    <div className="space-y-2">
      <h2 className="font-semibold text-ink">{t("exp.flag")}</h2>
      <p className="text-xs text-muted">{t("exp.flagHint")}</p>
      <input className="input" placeholder={t("exp.flagNotePlaceholder")} value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={() => setFlag("RED")} aria-pressed={current === "RED"}
          className={`btn-sm border ${current === "RED" ? "border-red-600 bg-red-600 text-white" : "border-red-300 text-red-700 hover:bg-red-50"}`}>
          🚩 {t("exp.flagRed")}
        </button>
        <button type="button" disabled={pending} onClick={() => setFlag("YELLOW")} aria-pressed={current === "YELLOW"}
          className={`btn-sm border ${current === "YELLOW" ? "border-amber-500 bg-amber-500 text-white" : "border-amber-300 text-amber-700 hover:bg-amber-50"}`}>
          🚩 {t("exp.flagYellow")}
        </button>
        {current && (
          <button type="button" disabled={pending} onClick={clear} className="btn-sm border border-line text-muted hover:bg-canvas">
            {t("exp.clearFlag")}
          </button>
        )}
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
    </div>
  );
}
