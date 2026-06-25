"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { saveLetterheadSettingsAction } from "../actions";

interface Current {
  letterheadUrl: string | null;
  hasLetterhead: boolean;
  marginTopMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  marginRightMm: number;
}

/**
 * Admin editor for the global letterhead PDF + generated-PDF margins. The PDF is
 * uploaded via /api/upload (returns an asset id) and only that id is sent to the
 * server action — mirroring the document PDF-upload flow.
 */
export function LetterheadEditor({ current }: { current: Current }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();

  const [top, setTop] = useState(String(current.marginTopMm));
  const [bottom, setBottom] = useState(String(current.marginBottomMm));
  const [left, setLeft] = useState(String(current.marginLeftMm));
  const [right, setRight] = useState(String(current.marginRightMm));

  const [newAssetId, setNewAssetId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [remove, setRemove] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setSaved(false);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Upload failed.");
      setNewAssetId(j.id);
      setFileName(file.name);
      setRemove(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function submit() {
    setError(null);
    setSaved(false);
    start(async () => {
      const r = await saveLetterheadSettingsAction({
        newLetterheadAssetId: newAssetId ?? undefined,
        removeLetterhead: remove,
        marginTopMm: Number(top),
        marginBottomMm: Number(bottom),
        marginLeftMm: Number(left),
        marginRightMm: Number(right),
      });
      if (!r.ok) { setError(r.error); return; }
      setSaved(true);
      setNewAssetId(null);
      setFileName(null);
      setRemove(false);
      router.refresh();
    });
  }

  const showsCurrent = current.hasLetterhead && !remove && !newAssetId;

  return (
    <div className="card max-w-2xl space-y-5 p-5">
      <div>
        <h2 className="font-semibold text-ink">{t("docs.letterhead.fileHeading")}</h2>
        <p className="mt-1 text-sm text-muted">{t("docs.letterhead.fileHint")}</p>
      </div>

      <div className="space-y-2">
        {showsCurrent && current.letterheadUrl && (
          <p className="text-sm">
            <span className="text-muted">{t("docs.letterhead.current")}: </span>
            <a href={current.letterheadUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">{t("docs.letterhead.view")}</a>
          </p>
        )}
        {!current.hasLetterhead && !newAssetId && <p className="text-sm text-muted">{t("docs.letterhead.none")}</p>}

        <input type="file" accept="application/pdf" className="input" onChange={onFile} />
        {uploading && <p className="text-xs text-muted">{t("common.loading")}</p>}
        {!uploading && fileName && <p className="text-xs text-green-600">{fileName}</p>}

        {current.hasLetterhead && !newAssetId && (
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={remove} onChange={(e) => setRemove(e.target.checked)} />
            {t("docs.letterhead.remove")}
          </label>
        )}
      </div>

      <div className="border-t border-line/60 pt-4">
        <h2 className="font-semibold text-ink">{t("docs.letterhead.marginsHeading")}</h2>
        <p className="mt-1 text-sm text-muted">{t("docs.letterhead.marginsHint")}</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="block">
            <span className="label">{t("docs.letterhead.top")}</span>
            <input type="number" min={0} className="input" value={top} onChange={(e) => setTop(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">{t("docs.letterhead.bottom")}</span>
            <input type="number" min={0} className="input" value={bottom} onChange={(e) => setBottom(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">{t("docs.letterhead.left")}</span>
            <input type="number" min={0} className="input" value={left} onChange={(e) => setLeft(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">{t("docs.letterhead.right")}</span>
            <input type="number" min={0} className="input" value={right} onChange={(e) => setRight(e.target.value)} />
          </label>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {saved && <div className="alert alert-success">{t("docs.letterhead.saved")}</div>}

      <button type="button" onClick={submit} disabled={pending || uploading} className="btn-primary">
        {pending ? "…" : t("docs.letterhead.save")}
      </button>
    </div>
  );
}
