"use client";
import { useState } from "react";
import { useT } from "@/i18n/client";
import { useDropdown } from "@/lib/use-dropdown";
import { tickState, isEdited, canEditMessage, type TickState } from "@/lib/chat/chat-logic";
import type { MessageRow } from "@/lib/chat/chat-service";

function hhmm(d: Date): string {
  const x = new Date(d);
  return `${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`;
}
const assetSrc = (id: string) => `/api/asset/${id}`;

function Ticks({ state }: { state: TickState }) {
  if (state === "none") return null;
  return (
    <span className={`ms-1 ${state === "read" ? "text-sky-400" : ""}`} aria-hidden>
      {state === "sent" ? "✓" : "✓✓"}
    </span>
  );
}

export function MessageBubble({
  m,
  meId,
  onReply,
  onEdit,
  onUnsend,
}: {
  m: MessageRow;
  meId: number;
  onReply: (m: MessageRow) => void;
  onEdit: (id: number, body: string) => void | Promise<void>;
  onUnsend: (id: number) => void | Promise<void>;
}) {
  const t = useT();
  const { open, setOpen, ref } = useDropdown<HTMLDivElement>();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.body);
  const mine = m.senderId === meId;
  const editable = mine && canEditMessage(m, meId, new Date());

  if (editing) {
    return (
      <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
        <div className="w-[85%] rounded-2xl border border-brand bg-surface p-2">
          <textarea
            autoFocus
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="input w-full resize-none py-1 text-sm"
          />
          <div className="mt-1 flex justify-end gap-2">
            <button
              onClick={() => {
                setEditing(false);
                setDraft(m.body);
              }}
              className="btn-sm text-muted hover:text-ink"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={async () => {
                const b = draft.trim();
                if (!b) return;
                setEditing(false);
                await onEdit(m.id, b);
              }}
              className="btn-primary btn-sm"
            >
              {t("common.save")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const menu = !m.unsentAt ? (
    <div className="relative self-center" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t("chat.messageActions")}
        className="px-1 text-muted opacity-0 transition hover:text-ink focus:opacity-100 group-hover:opacity-100"
      >
        ⋯
      </button>
      {open && (
        <div
          className={`absolute z-10 mt-1 w-32 overflow-hidden rounded-lg border border-line bg-surface py-1 text-sm shadow-lg ${mine ? "end-0" : "start-0"}`}
        >
          <button
            onClick={() => {
              setOpen(false);
              onReply(m);
            }}
            className="block w-full px-3 py-1.5 text-start text-ink hover:bg-canvas"
          >
            {t("chat.reply")}
          </button>
          {editable && (
            <button
              onClick={() => {
                setOpen(false);
                setDraft(m.body);
                setEditing(true);
              }}
              className="block w-full px-3 py-1.5 text-start text-ink hover:bg-canvas"
            >
              {t("chat.edit")}
            </button>
          )}
          {mine && (
            <button
              onClick={() => {
                setOpen(false);
                if (confirm(t("chat.unsendConfirm"))) void onUnsend(m.id);
              }}
              className="block w-full px-3 py-1.5 text-start text-red-600 hover:bg-canvas"
            >
              {t("chat.unsend")}
            </button>
          )}
        </div>
      )}
    </div>
  ) : null;

  const bubble = (
    <div
      className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-sm ${mine ? "bg-brand text-brand-fg" : "bg-canvas text-ink"}`}
    >
      {m.replyToId && (
        <div
          className={`mb-1 truncate border-s-2 ps-2 text-xs ${mine ? "border-brand-fg/40 text-brand-fg/80" : "border-line text-muted"}`}
        >
          {(m.replyToSenderId === meId ? `${t("chat.you")}: ` : "") + (m.replyToBody || t("chat.photo"))}
        </div>
      )}
      {!m.unsentAt && m.attachments.length > 0 && (
        <div className="mb-1 flex flex-wrap gap-1">
          {m.attachments.map((a) => (
            <a key={a.id} href={assetSrc(a.assetId)} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={assetSrc(a.assetId)} alt="" className="max-h-48 max-w-[12rem] rounded-lg object-cover" />
            </a>
          ))}
        </div>
      )}
      {m.unsentAt ? (
        <span className="italic opacity-70">{t("chat.deleted")}</span>
      ) : m.body ? (
        <span className="whitespace-pre-wrap break-words">{m.body}</span>
      ) : null}
      <span
        className={`ms-2 inline-flex items-center align-middle text-[10px] ${mine ? "text-brand-fg/70" : "text-muted"}`}
      >
        {isEdited(m) && <span className="me-1">{t("chat.edited")}</span>}
        {hhmm(m.createdAt)}
        {mine && <Ticks state={tickState(m, meId)} />}
      </span>
    </div>
  );

  return (
    <div className={`group flex items-end gap-1 ${mine ? "justify-end" : "justify-start"}`}>
      {mine && menu}
      {bubble}
      {!mine && menu}
    </div>
  );
}
