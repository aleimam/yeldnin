"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useT } from "@/i18n/client";
import { displayName } from "@/lib/users/users-logic";
import { formatBizDate } from "@/lib/format/dates";
import { uploadImage } from "@/lib/chat/upload-image";
import { statusLabelKey } from "@/lib/inquiry/inquiry-logic";
import { replyInquiryAction, closeInquiryAction } from "@/app/inquiries/actions";
import type { InquiryDetail } from "@/lib/inquiry/inquiry-service";

const assetSrc = (id: string) => `/api/asset/${id}`;
function hhmm(d: Date): string {
  const x = new Date(d);
  return `${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`;
}

function StatusBadge({ status }: { status: string }) {
  const t = useT();
  const tone =
    status === "CLOSED" ? "bg-canvas text-muted" : status === "ANSWERED" ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400" : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>{t(statusLabelKey(status))}</span>;
}

export function InquiryThread({
  detail,
  meId,
  dispositions,
}: {
  detail: InquiryDetail;
  meId: number;
  dispositions: { id: number; label: string; labelAr: string | null }[];
}) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<{ assetId: string; url: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dispId, setDispId] = useState("");

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

  async function reply() {
    const b = body.trim();
    if (!b && photos.length === 0) return;
    setBusy(true);
    setError(null);
    const res = await replyInquiryAction(detail.id, { body: b, attachments: photos.map((p) => ({ assetId: p.assetId })) });
    setBusy(false);
    if (!res.ok) {
      setError(t(res.error));
      return;
    }
    setBody("");
    setPhotos([]);
    router.refresh();
  }

  async function close() {
    if (!dispId) return;
    setBusy(true);
    setError(null);
    const res = await closeInquiryAction(detail.id, Number(dispId));
    setBusy(false);
    if (!res.ok) {
      setError(t(res.error));
      return;
    }
    router.refresh();
  }

  const dispLabel = (d: { label: string; labelAr: string | null }) => (locale === "ar" && d.labelAr ? d.labelAr : d.label);

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-2 p-4">
        <div className="text-sm">
          <div className="font-semibold text-ink">
            {detail.uid ?? `#${detail.id}`} · <StatusBadge status={detail.status} />
          </div>
          <div className="mt-1 text-muted">
            {t("inq.from")} <span className="text-ink">{displayName(detail.initiator, locale)}</span> · {t("inq.to")}{" "}
            <span className="text-ink">{displayName(detail.recipient, locale)}</span>
          </div>
          <div className="text-xs text-muted">
            {t("inq.unit")}: {t(`inq.kind.${detail.unitKind}`)} #{detail.unitId}
          </div>
        </div>
        {detail.dispositionLabel && (
          <span className="rounded-full bg-canvas px-2 py-0.5 text-xs text-ink">{detail.dispositionLabel}</span>
        )}
      </div>

      <div className="card space-y-3 p-4">
        {detail.messages.map((m) => {
          const mine = m.senderId === meId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-brand text-brand-fg" : "bg-canvas text-ink"}`}>
                <div className={`mb-0.5 text-[11px] ${mine ? "text-brand-fg/70" : "text-muted"}`}>
                  {displayName(m.sender, locale)} · {formatBizDate(m.createdAt)} {hhmm(m.createdAt)}
                </div>
                {m.attachments.length > 0 && (
                  <div className="mb-1 flex flex-wrap gap-1">
                    {m.attachments.map((a) => (
                      <a key={a.id} href={assetSrc(a.assetId)} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={assetSrc(a.assetId)} alt="" className="max-h-48 max-w-[12rem] rounded-lg object-cover" />
                      </a>
                    ))}
                  </div>
                )}
                {m.body && <span className="whitespace-pre-wrap break-words">{m.body}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {detail.canReply && (
        <div className="card space-y-2 p-4">
          <textarea
            className="input min-h-[4rem]"
            rows={2}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("inq.reply")}
          />
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
            <button onClick={reply} disabled={busy} className="btn-primary btn-sm">
              {busy ? "…" : t("inq.send")}
            </button>
          </div>
        </div>
      )}

      {detail.canClose && (
        <div className="card flex flex-wrap items-end gap-2 p-4">
          <div className="flex-1">
            <label className="label">{t("inq.closeWith")}</label>
            <select className="input" value={dispId} onChange={(e) => setDispId(e.target.value)}>
              <option value="">{t("inq.pickDisposition")}</option>
              {dispositions.map((d) => (
                <option key={d.id} value={d.id}>
                  {dispLabel(d)}
                </option>
              ))}
            </select>
          </div>
          <button onClick={close} disabled={busy || !dispId} className="btn-primary btn-sm">
            {t("inq.close")}
          </button>
        </div>
      )}
    </div>
  );
}
