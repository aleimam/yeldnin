"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { saveCsTypesAction } from "../actions";

type Row = { id: number; name: string; weight: number; remove?: boolean };

export function TypesEditor({ scope, title, initial }: { scope: string; title: string; initial: { id: number; name: string; weight: number }[] }) {
  const t = useT();
  const router = useRouter();
  const withWeights = scope === "CALL"; // call types are weighted within the overall average
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<Row[]>(initial.map((r) => ({ ...r })));
  const [add, setAdd] = useState("");
  const [addWeight, setAddWeight] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = () => { setSaved(false); setError(null); };
  const setName = (id: number, name: string) => { dirty(); setRows((p) => p.map((r) => (r.id === id ? { ...r, name } : r))); };
  const setWeight = (id: number, w: string) => { dirty(); setRows((p) => p.map((r) => (r.id === id ? { ...r, weight: Number(w) || 0 } : r))); };
  const toggleRemove = (id: number) => { dirty(); setRows((p) => p.map((r) => (r.id === id ? { ...r, remove: !r.remove } : r))); };

  const liveSum = rows.filter((r) => !r.remove).reduce((s, r) => s + (r.weight || 0), 0) + (add.trim() ? Number(addWeight) || 0 : 0);

  function save() {
    setSaved(false);
    setError(null);
    if (withWeights && Math.round(liveSum) !== 100) {
      setError(t("cs.weightsSum100"));
      return;
    }
    start(async () => {
      await saveCsTypesAction(
        scope,
        rows.map((r) => ({ id: r.id, name: r.name, weight: r.weight || 0, remove: !!r.remove })),
        add.trim() ? { name: add.trim(), weight: Number(addWeight) || 0 } : null,
      );
      setAdd("");
      setAddWeight("");
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="card space-y-3 p-5">
      <h2 className="font-semibold text-ink">{title}</h2>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-2">
            <input
              className={`input flex-1 ${r.remove ? "line-through opacity-50" : ""}`}
              value={r.name}
              onChange={(e) => setName(r.id, e.target.value)}
              disabled={r.remove}
            />
            {withWeights && (
              <input
                type="number"
                className="input w-20 text-end"
                value={r.weight}
                onChange={(e) => setWeight(r.id, e.target.value)}
                disabled={r.remove}
                aria-label={t("cs.weight")}
              />
            )}
            <button type="button" onClick={() => toggleRemove(r.id)} className="text-sm text-red-600 hover:underline">
              {r.remove ? t("cs.undo") : t("common.delete")}
            </button>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted">—</p>}
      </div>
      <div className="flex items-center gap-2">
        <input className="input flex-1" placeholder={t("cs.addType")} value={add} onChange={(e) => { dirty(); setAdd(e.target.value); }} />
        {withWeights && (
          <input type="number" className="input w-20 text-end" placeholder={t("cs.weight")} value={addWeight} onChange={(e) => { dirty(); setAddWeight(e.target.value); }} aria-label={t("cs.weight")} />
        )}
      </div>
      {withWeights && (
        <p className={`text-xs ${Math.round(liveSum) === 100 ? "text-muted" : "text-red-600"}`}>{t("cs.weightSum")}: {liveSum}% / 100%</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={pending} className="btn-primary">{pending ? "…" : t("common.save")}</button>
        {saved && <span className="text-sm text-green-600">{t("cs.saved")}</span>}
      </div>
    </div>
  );
}
