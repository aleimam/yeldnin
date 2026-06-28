"use client";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n/client";
import { compressImage } from "@/lib/chat/compress";

export interface UploadedPhoto {
  id: string;
  url: string;
  mime?: string;
}

// Keep in sync with MAX_UPLOAD_BYTES in assets-service (that file is server-only,
// so the limit can't be imported into this client component).
const MAX_UPLOAD_BYTES = 32 * 1024 * 1024; // 32 MB

async function uploadFile(file: File, t: (k: string) => string): Promise<UploadedPhoto> {
  const fd = new FormData();
  // Compress images client-side (WebP, ≤1600px) before upload so every module's
  // photo uploads stay small; non-images (PDFs) pass through untouched. Note that
  // compressImage falls back to the ORIGINAL file when the browser can't decode it
  // (e.g. HEIC from an iPhone), so the post-compression size can still be large.
  let toSend = file;
  if (file.type.startsWith("image/")) {
    const { blob } = await compressImage(file);
    const base = file.name.replace(/\.[^.]+$/, "") || "image";
    toSend = new File([blob], `${base}.webp`, { type: blob.type || "image/webp" });
  }
  // Pre-flight the size client-side: an oversize body is otherwise rejected by the
  // reverse proxy mid-stream, which surfaces as a cryptic "Failed to fetch".
  if (toSend.size > MAX_UPLOAD_BYTES) throw new Error(t("upload.tooLarge"));
  fd.append("file", toSend);
  let res: Response;
  try {
    res = await fetch("/api/upload", { method: "POST", body: fd });
  } catch {
    // fetch() rejects with a TypeError on a network failure or a proxy connection
    // reset (e.g. the body exceeded the proxy's client_max_body_size) — neither
    // reaches the app, so translate it into something the user can act on.
    throw new Error(t("upload.network"));
  }
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error ?? t("upload.failed"));
  }
  return res.json();
}

/** Drag/drop/paste/select image uploader. Reports asset ids via onChange. */
export function PhotoUpload({
  photos,
  onChange,
  accept = "image/*",
  allowPdf = false,
}: {
  photos: UploadedPhoto[];
  onChange: (next: UploadedPhoto[]) => void;
  accept?: string;
  allowPdf?: boolean;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Latest photos, so async appends (paste/drop) don't drop earlier ones via a stale closure.
  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  const accepts = (f: File) => f.type.startsWith("image/") || (allowPdf && f.type === "application/pdf");

  async function handleFiles(files: File[]) {
    const ok = files.filter(accepts);
    if (!ok.length) return;
    setError(null);
    setBusy(true);
    try {
      const added: UploadedPhoto[] = [];
      for (const f of ok) added.push(await uploadFile(f, t));
      if (added.length) onChange([...photosRef.current, ...added]);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("upload.failed"));
    } finally {
      setBusy(false);
    }
  }

  // Paste anywhere on the page: pull image/file data from the clipboard. Covers
  // both clipboardData.files and the items[].getAsFile() path that screenshots
  // and web-copied images use. Pastes without file data (plain text) pass through.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const cd = e.clipboardData;
      if (!cd) return;
      // Prefer clipboardData.files; fall back to items[].getAsFile() only when
      // files is empty (some web-copied images live only in items). Merging both
      // would double-upload, since a normal paste populates each with the same file.
      let files = Array.from(cd.files);
      if (!files.length) {
        files = Array.from(cd.items)
          .filter((it) => it.kind === "file")
          .map((it) => it.getAsFile())
          .filter((f): f is File => f != null);
      }
      const ok = files.filter(accepts);
      if (!ok.length) return;
      e.preventDefault();
      void handleFiles(ok);
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
    // handleFiles/accepts only vary with allowPdf; latest photos come from the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowPdf]);

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files.length) void handleFiles(Array.from(e.dataTransfer.files));
        }}
        className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-line px-4 py-6 text-center text-sm text-muted hover:border-brand/50"
        tabIndex={0}
      >
        <span className="text-2xl">🖼️</span>
        <span>{busy ? t("common.uploading") : t("upload.hint")}</span>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))}
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {photos.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {photos.map((p) => (
            <div key={p.id} className="group relative">
              <a href={p.url} target="_blank" rel="noreferrer">
                {p.mime && !p.mime.startsWith("image/") ? (
                  <span className="grid h-16 w-16 place-items-center rounded-lg border border-line text-2xl">📄</span>
                ) : (
                  <img src={p.url} alt="" className="h-16 w-16 rounded-lg border border-line object-cover" />
                )}
              </a>
              <button
                type="button"
                onClick={() => onChange(photos.filter((x) => x.id !== p.id))}
                className="absolute -end-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-red-600 text-xs text-white opacity-0 transition group-hover:opacity-100"
                aria-label={t("common.remove")}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
