"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { PhotoUpload, type UploadedPhoto } from "@/components/PhotoUpload";
import { EXCEPTION_POOLS } from "@/lib/exceptions/exception-logic";
import { flagItemsAction } from "./actions";

interface Candidate {
  id: number;
  label: string;
}

/**
 * Flag one or more items into an exception pool. `single` mode (item page)
 * pre-selects the lone item and hides the checklist; otherwise (container
 * views) it shows a checklist to pick which items to flag.
 */
export function FlagItemsControl({ items, single = false }: { items: Candidate[]; single?: boolean }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [pool, setPool] = useState<string>("LOST");
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!items.length) return null;
  const ids = single ? items.map((i) => i.id) : [...sel];

  const toggle = (id: number) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const submit = () => {
    setErr(null);
    if (!ids.length) return;
    start(async () => {
      const res = await flagItemsAction(ids, pool, { note: note.trim() || null, photoAssetIds: photos.map((p) => p.id) });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setOpen(false);
      setSel(new Set());
      setNote("");
      setPhotos([]);
      router.refresh();
    });
  };

  if (!open) {
    return (
      <button type="button" className="btn-secondary px-3 py-1.5 text-sm" onClick={() => setOpen(true)}>
        🚩 {t("exceptions.flag")}
      </button>
    );
  }

  return (
    <div className="card space-y-3 border-amber-300 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">{t("exceptions.flag")}</h3>
        <button type="button" className="text-xs text-muted hover:underline" onClick={() => setOpen(false)}>✕</button>
      </div>

      {!single && (
        <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-line p-2">
          {items.map((it) => (
            <label key={it.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={sel.has(it.id)} onChange={() => toggle(it.id)} />
              <span className="text-ink">{it.label}</span>
            </label>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">{t("exceptions.flagPool")}</span>
          <select className="input" value={pool} onChange={(e) => setPool(e.target.value)}>
            {EXCEPTION_POOLS.map((p) => (
              <option key={p} value={p}>{t(`exceptions.pool.${p}`)}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">{t("exceptions.flagNote")}</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>

      <div>
        <span className="label">{t("exceptions.flagPhotos")}</span>
        <PhotoUpload photos={photos} onChange={setPhotos} />
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      <button type="button" className="btn-primary" disabled={pending || !ids.length} onClick={submit}>
        🚩 {t("exceptions.flagSubmit", { n: ids.length })}
      </button>
    </div>
  );
}
