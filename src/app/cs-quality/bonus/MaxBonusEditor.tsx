"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { saveRepBonusesAction } from "../actions";

export function MaxBonusEditor({ initial }: { initial: { id: number; name: string; maxBonus: number }[] }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rows, setRows] = useState(initial);
  const [saved, setSaved] = useState(false);

  const setVal = (id: number, v: string) => { setSaved(false); setRows((p) => p.map((r) => (r.id === id ? { ...r, maxBonus: Number(v) || 0 } : r))); };

  function save() {
    setSaved(false);
    start(async () => {
      await saveRepBonusesAction(rows.map((r) => ({ userId: r.id, maxBonus: r.maxBonus })));
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="card space-y-3 p-5">
      <h2 className="font-semibold text-ink">{t("cs.maxBonusTitle")}</h2>
      <p className="text-sm text-muted">{t("cs.maxBonusHint")}</p>
      <table className="w-full text-sm" data-cards>
        <thead><tr className="border-b border-line"><th className="th">{t("cs.salesRep")}</th><th className="th text-end">{t("cs.maxBonusEgp")}</th></tr></thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="td" data-label={t("cs.salesRep")}>{r.name}</td>
              <td className="td text-end" data-label={t("cs.maxBonusEgp")}><input type="number" className="input ms-auto w-32 text-end" value={r.maxBonus} onChange={(e) => setVal(r.id, e.target.value)} /></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td className="td text-muted" colSpan={2}>{t("cs.noReps")}</td></tr>}
        </tbody>
      </table>
      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={pending} className="btn-primary">{pending ? "…" : t("common.save")}</button>
        {saved && <span className="text-sm text-green-600">{t("cs.saved")}</span>}
      </div>
    </div>
  );
}
