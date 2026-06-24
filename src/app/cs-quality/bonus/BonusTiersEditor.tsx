"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { TrashIcon } from "@/components/icons/TrashIcon";
import { saveBonusTiersAction } from "../actions";

type Row = { fromPct: number; bonusPct: number };

export function BonusTiersEditor({ initial }: { initial: Row[] }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<Row[]>(initial.length ? initial : [{ fromPct: 0, bonusPct: 0 }]);
  const [saved, setSaved] = useState(false);

  const set = (i: number, k: keyof Row, v: string) => { setSaved(false); setRows((p) => p.map((r, idx) => (idx === i ? { ...r, [k]: Number(v) || 0 } : r))); };
  const addRow = () => { setSaved(false); setRows((p) => [...p, { fromPct: 0, bonusPct: 0 }]); };
  const removeRow = (i: number) => { setSaved(false); setRows((p) => p.filter((_, idx) => idx !== i)); };

  function save() {
    setSaved(false);
    start(async () => {
      await saveBonusTiersAction(rows);
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="card space-y-3 p-5">
      <h2 className="font-semibold text-ink">{t("cs.tiersTitle")}</h2>
      <p className="text-sm text-muted">{t("cs.tiersHint")}</p>
      <table className="w-full text-sm">
        <thead><tr className="border-b border-line"><th className="th">{t("cs.tierFrom")}</th><th className="th">{t("cs.tierBonus")}</th><th className="th"></th></tr></thead>
        <tbody className="divide-y divide-line">
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="td"><input type="number" className="input w-24 text-end" value={r.fromPct} onChange={(e) => set(i, "fromPct", e.target.value)} /> %</td>
              <td className="td"><input type="number" className="input w-24 text-end" value={r.bonusPct} onChange={(e) => set(i, "bonusPct", e.target.value)} /> %</td>
              <td className="td text-end"><button type="button" onClick={() => removeRow(i)} className="text-red-600 hover:text-red-700" title={t("common.delete")} aria-label={t("common.delete")}><TrashIcon className="h-4 w-4" /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={addRow} className="text-sm text-brand hover:underline">+ {t("cs.addTier")}</button>
      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={pending} className="btn-primary">{pending ? "…" : t("common.save")}</button>
        {saved && <span className="text-sm text-green-600">{t("cs.saved")}</span>}
      </div>
    </div>
  );
}
