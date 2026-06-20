"use client";
import { useState } from "react";
import Link from "next/link";
import { useLocale, useT } from "@/i18n/client";
import { displayName } from "@/lib/users/users-logic";
import { uploadImage } from "@/lib/chat/upload-image";
import { listUnitActorsAction, createInquiryAction } from "@/app/inquiries/actions";
import type { InqUserLite } from "@/lib/inquiry/inquiry-service";

/** "Ask about this" entry point dropped onto any unit (item / container) detail
 *  page. Loads the people who acted on the unit, lets the user pick one + write a
 *  message (+ photos), and opens an inquiry routed to that person's team. */
export function InquiryLauncher({ unitKind, unitId }: { unitKind: string; unitId: number }) {
  const t = useT();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [actors, setActors] = useState<InqUserLite[] | null>(null);
  const [recipientId, setRecipientId] = useState("");
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<{ assetId: string; url: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<number | null>(null);

  async function expand() {
    setOpen(true);
    if (actors === null) setActors(await listUnitActorsAction(unitKind, unitId));
  }

  async function addPhotos(files: File[]) {
    const imgs = files.filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) return;
    setBusy(true);
    try {
      const added: { assetId: string; url: string }[] = [];
      for (const f of imgs) {
        const up = await uploadImage(f);
        if (up) added.push({ assetId: up.assetId, url: up.url });
      }
      setPhotos((p) => [...p, ...added]);
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setError(null);
    if (!recipientId) {
      setError(t("inq.err.pickRecipient"));
      return;
    }
    setBusy(true);
    const res = await createInquiryAction({
      unitKind,
      unitId,
      recipientUserId: Number(recipientId),
      body,
      attachments: photos.map((p) => ({ assetId: p.assetId })),
    });
    setBusy(false);
    if (!res.ok) {
      setError(t(res.error));
      return;
    }
    setCreatedId(res.id);
    setBody("");
    setPhotos([]);
    setRecipientId("");
  }

  if (createdId != null) {
    return (
      <div className="alert alert-success flex items-center justify-between gap-3">
        <span>{t("inq.created")}</span>
        <Link href={`/inquiries/${createdId}`} className="btn-sm btn-primary">
          {t("inq.view")}
        </Link>
      </div>
    );
  }

  if (!open) {
    return (
      <button onClick={expand} className="btn-sm btn-secondary">
        💬 {t("inq.ask")}
      </button>
    );
  }

  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-ink">{t("inq.new")}</h3>
        <button onClick={() => setOpen(false)} className="text-muted hover:text-ink" aria-label={t("common.close")}>
          ✕
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div>
        <label className="label">{t("inq.recipient")}</label>
        {actors === null ? (
          <p className="text-sm text-muted">{t("common.uploading")}</p>
        ) : actors.length === 0 ? (
          <p className="text-sm text-muted">{t("inq.noActors")}</p>
        ) : (
          <select className="input" value={recipientId} onChange={(e) => setRecipientId(e.target.value)}>
            <option value="">{t("inq.pickRecipient")}</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>
                {displayName(a, locale)}
              </option>
            ))}
          </select>
        )}
      </div>

      <div>
        <label className="label">{t("inq.message")}</label>
        <textarea className="input min-h-[5rem]" rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>

      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photos.map((p) => (
            <div key={p.assetId} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="h-14 w-14 rounded-lg border border-line object-cover" />
              <button
                onClick={() => setPhotos((cur) => cur.filter((x) => x.assetId !== p.assetId))}
                className="absolute -end-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-red-600 text-xs text-white"
                aria-label={t("common.remove")}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <label className="btn-sm btn-secondary cursor-pointer">
          📎 {t("chat.attachPhoto")}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void addPhotos(Array.from(e.target.files));
              e.target.value = "";
            }}
          />
        </label>
        <button onClick={submit} disabled={busy} className="btn-primary btn-sm">
          {busy ? "…" : t("inq.send")}
        </button>
      </div>
    </div>
  );
}
