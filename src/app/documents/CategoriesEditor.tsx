"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { TrashIcon } from "@/components/icons/TrashIcon";
import { saveDocCategoriesAction } from "./actions";

type Row = { id?: number; name: string; remove?: boolean };

/** Add/rename/remove document categories, saved as one batch. */
export function CategoriesEditor({ initial }: { initial: { id: number; name: string }[] }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<Row[]>(initial.map((r) => ({ id: r.id, name: r.name })));
  const [add, setAdd] = useState("");
  const [saved, setSaved] = useState(false);

  const dirty = () => setSaved(false);
  const setName = (i: number, name: string) => { dirty(); setRows((p) => p.map((r, idx) => (idx === i ? { ...r, name } : r))); };
  const toggleRemove = (i: number) => { dirty(); setRows((p) => p.map((r, idx) => (idx === i ? { ...r, remove: !r.remove } : r))); };

  function save() {
    setSaved(false);
    const payload: Row[] = [...rows];
    if (add.trim()) payload.push({ name: add.trim() });
    start(async () => {
      await saveDocCategoriesAction(payload);
      setAdd("");
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="card max-w-xl space-y-3 p-5">
      <h2 className="font-semibold text-ink">{t("docs.cat.title")}</h2>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={r.id ?? `new-${i}`} className="flex items-center gap-2">
            <input
              className={`input flex-1 ${r.remove ? "line-through opacity-50" : ""}`}
              placeholder={t("docs.cat.name")}
              value={r.name}
              disabled={r.remove}
              onChange={(e) => setName(i, e.target.value)}
            />
            <button
              type="button"
              onClick={() => toggleRemove(i)}
              className="text-sm text-red-600 hover:text-red-700"
              title={r.remove ? t("common.cancel") : t("docs.cat.remove")}
              aria-label={r.remove ? t("common.cancel") : t("docs.cat.remove")}
            >
              {r.remove ? t("common.cancel") : <TrashIcon className="h-4 w-4" />}
            </button>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted">—</p>}
      </div>
      <div className="flex items-center gap-2">
        <input className="input flex-1" placeholder={t("docs.cat.add")} value={add} onChange={(e) => { dirty(); setAdd(e.target.value); }} />
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={pending} className="btn-primary">{pending ? "…" : t("common.save")}</button>
        {saved && <span className="text-sm text-green-600">{t("common.saved")}</span>}
      </div>
    </div>
  );
}
