"use client";
import { useRef, useState } from "react";

export interface UploadedPhoto {
  id: string;
  url: string;
  mime?: string;
}

async function uploadFile(file: File): Promise<UploadedPhoto> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error ?? "Upload failed.");
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const accepts = (f: File) =>
    f.type.startsWith("image/") || (allowPdf && f.type === "application/pdf");

  async function handleFiles(files: FileList | File[]) {
    setError(null);
    setBusy(true);
    try {
      const added: UploadedPhoto[] = [];
      for (const f of Array.from(files)) {
        if (!accepts(f)) continue;
        added.push(await uploadFile(f));
      }
      if (added.length) onChange([...photos, ...added]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files.length) void handleFiles(e.dataTransfer.files);
        }}
        onPaste={(e) => {
          const ok = Array.from(e.clipboardData.files).filter(accepts);
          if (ok.length) void handleFiles(ok);
        }}
        className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-line px-4 py-6 text-center text-sm text-muted hover:border-brand/50"
        tabIndex={0}
      >
        <span className="text-2xl">🖼️</span>
        <span>{busy ? "Uploading…" : "Click, drop, or paste images (max 32 MB)"}</span>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
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
                aria-label="Remove"
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
