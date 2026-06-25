"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { RichTextEditor } from "@/components/documents/RichTextEditor";
import { DOC_KINDS, type DocKind } from "@/lib/documents/documents-logic";
import { createDocumentAction, updateDocumentContentAction, updateDocumentMetaAction } from "./actions";

interface Initial {
  kind: DocKind;
  title: string;
  description: string;
  categoryId: number | null;
  contentHtml: string;
  assetId: string | null;
  reviewBy: string | null; // yyyy-mm-dd
}

/**
 * Create/edit a document. The kind selector is locked once a document exists.
 * DOC bodies use the rich-text editor; PDFs upload a file via /api/upload.
 * `canManageMeta` disables the metadata fields for Operate-only editors, who
 * may change content but not title/category/description.
 */
export function DocumentForm({
  categories,
  editId,
  initial,
  canManageMeta = true,
}: {
  categories: { id: number; name: string }[];
  editId?: number;
  initial?: Initial;
  canManageMeta?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();

  const [kind, setKind] = useState<DocKind>(initial?.kind ?? "PDF");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [categoryId, setCategoryId] = useState<string>(initial?.categoryId != null ? String(initial.categoryId) : "");
  const [reviewBy, setReviewBy] = useState<string>(initial?.reviewBy ?? "");
  const [contentHtml, setContentHtml] = useState(initial?.contentHtml ?? "");
  const [assetId, setAssetId] = useState<string | null>(initial?.assetId ?? null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Upload failed.");
      setAssetId(j.id);
      setFileName(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function submit() {
    setError(null);
    if (!title.trim()) { setError(t("docs.titleRequired")); return; }
    if (kind === "PDF" && !editId && !assetId) { setError(t("docs.pdfRequired")); return; }
    const catId = categoryId ? Number(categoryId) : null;

    start(async () => {
      if (editId) {
        // Content first: DOC HTML, or a replaced PDF file when a new one was uploaded.
        if (kind === "DOC") {
          const r = await updateDocumentContentAction(editId, contentHtml);
          if (!r.ok) { setError(r.error); return; }
        } else if (assetId && assetId !== initial?.assetId) {
          const r = await updateDocumentContentAction(editId, "", assetId);
          if (!r.ok) { setError(r.error); return; }
        }
        if (canManageMeta) {
          const r = await updateDocumentMetaAction(editId, { title: title.trim(), description: description.trim() || null, categoryId: catId, reviewBy: reviewBy || null });
          if (!r.ok) { setError(r.error); return; }
        }
        router.push(`/documents/${editId}`);
      } else {
        const r = await createDocumentAction({
          kind,
          title: title.trim(),
          description: description.trim() || undefined,
          categoryId: catId,
          assetId: kind === "PDF" ? assetId : null,
          contentHtml: kind === "DOC" ? contentHtml : null,
          reviewBy: reviewBy || null,
        });
        if (!r.ok || r.id == null) { setError(r.ok ? "Failed." : r.error); return; }
        router.push(`/documents/${r.id}`);
      }
    });
  }

  return (
    <div className="card max-w-3xl space-y-4 p-5">
      <div>
        <label className="label">{t("docs.kindField")}</label>
        <select
          className="input"
          value={kind}
          disabled={!!editId}
          onChange={(e) => setKind(e.target.value as DocKind)}
        >
          {DOC_KINDS.map((k) => <option key={k} value={k}>{t(`docs.kind.${k}`)}</option>)}
        </select>
      </div>

      <div>
        <label className="label">{t("docs.titleField")}</label>
        <input className="input" value={title} disabled={!canManageMeta} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div>
        <label className="label">{t("docs.description")}</label>
        <textarea className="input min-h-[80px]" value={description} disabled={!canManageMeta} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div>
        <label className="label">{t("docs.category")}</label>
        <select className="input" value={categoryId} disabled={!canManageMeta} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">{t("docs.noCategory")}</option>
          {categories.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
        </select>
      </div>

      <div>
        <label className="label">{t("docs.reviewByField")}</label>
        <input type="date" className="input" value={reviewBy} disabled={!canManageMeta} onChange={(e) => setReviewBy(e.target.value)} />
        <p className="mt-1 text-xs text-muted">{t("docs.reviewByHint")}</p>
      </div>

      {kind === "DOC" ? (
        <div>
          <label className="label">{t("docs.content")}</label>
          <RichTextEditor value={contentHtml} onChange={setContentHtml} />
        </div>
      ) : (
        <div>
          <label className="label">{t("docs.uploadPdf")}</label>
          <input type="file" accept="application/pdf" className="input" onChange={onFile} />
          {uploading && <p className="mt-1 text-xs text-muted">{t("common.loading")}</p>}
          {!uploading && fileName && <p className="mt-1 text-xs text-green-600">{fileName}</p>}
          {!uploading && !fileName && assetId && <p className="mt-1 text-xs text-muted">{t("docs.kind.PDF")}</p>}
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      <div className="flex items-center gap-3">
        <button type="button" onClick={submit} disabled={pending || uploading} className="btn-primary">
          {pending ? "…" : editId ? t("docs.save") : t("docs.create")}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-secondary">{t("common.cancel")}</button>
      </div>
    </div>
  );
}
