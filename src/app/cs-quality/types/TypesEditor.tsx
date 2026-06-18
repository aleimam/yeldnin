"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { saveCsTypesAction } from "../actions";

type Row = { id: number; name: string; remove?: boolean };

export function TypesEditor({ scope, title, initial }: { scope: string; title: string; initial: { id: number; name: string }[] }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<Row[]>(initial.map((r) => ({ ...r })));
  const [add, setAdd] = useState("");
  const [saved, setSaved] = useState(false);

  const setName = (id: number, name: string) => { setSaved(false); setRows((p) => p.map((r) => (r.id === id ? { ...r, name } : r))); };
  const toggleRemove = (id: number) => { setSaved(false); setRows((p) => p.map((r) => (r.id === id ? { ...r, remove: !r.remove } : r))); };

  function save() {
    setSaved(false);
    start(async () => {
      await saveCsTypesAction(
        scope,
        rows.map((r) => ({ id: r.id, name: r.name, remove: !!r.remove })),
        add.trim() ? { name: add.trim() } : null,
      );
      setAdd("");
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
            <button type="button" onClick={() => toggleRemove(r.id)} className="text-sm text-red-600 hover:underline">
              {r.remove ? t("cs.undo") : t("common.delete")}
            </button>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted">—</p>}
      </div>
      <input className="input" placeholder={t("cs.addType")} value={add} onChange={(e) => { setSaved(false); setAdd(e.target.value); }} />
      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={pending} className="btn-primary">{pending ? "…" : t("common.save")}</button>
        {saved && <span className="text-sm text-green-600">{t("cs.saved")}</span>}
      </div>
    </div>
  );
}
