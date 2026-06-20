"use client";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n/client";
import { useDropdown } from "@/lib/use-dropdown";
import { compressImage } from "@/lib/chat/compress";
import type { MessageRow } from "@/lib/chat/chat-service";
import { MessageBubble } from "./MessageBubble";
import { EmojiPicker } from "./EmojiPicker";

interface PendingAttachment {
  assetId: string;
  width: number;
  height: number;
  previewUrl: string;
}

/** Compress (client-side WebP) then upload to the chat-only endpoint. */
async function uploadChatImage(file: File): Promise<PendingAttachment | null> {
  const { blob, width, height } = await compressImage(file);
  const fd = new FormData();
  fd.append("file", new File([blob], "photo.webp", { type: blob.type || "image/webp" }));
  const res = await fetch("/api/chat/upload", { method: "POST", body: fd });
  if (!res.ok) return null;
  const j = (await res.json()) as { id: string; url: string };
  return { assetId: j.id, width, height, previewUrl: j.url };
}

export function MessageThread({
  meId,
  messages,
  onSend,
  onEdit,
  onUnsend,
}: {
  meId: number;
  messages: MessageRow[];
  onSend: (
    body: string,
    attachments: { assetId: string; width: number; height: number }[],
    replyToId: number | null,
  ) => void | Promise<void>;
  onEdit: (id: number, body: string) => void | Promise<void>;
  onUnsend: (id: number) => void | Promise<void>;
}) {
  const t = useT();
  const [text, setText] = useState("");
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [replyTo, setReplyTo] = useState<MessageRow | null>(null);
  const [busy, setBusy] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const emoji = useDropdown<HTMLDivElement>();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, pending]);

  async function addFiles(files: File[]) {
    const imgs = files.filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) return;
    setBusy(true);
    try {
      const added: PendingAttachment[] = [];
      for (const f of imgs) {
        const up = await uploadChatImage(f);
        if (up) added.push(up);
      }
      if (added.length) setPending((p) => [...p, ...added]);
    } finally {
      setBusy(false);
    }
  }

  function insertEmoji(e: string) {
    const ta = taRef.current;
    if (!ta) {
      setText((x) => x + e);
      return;
    }
    const start = ta.selectionStart ?? text.length;
    const end = ta.selectionEnd ?? text.length;
    setText(text.slice(0, start) + e + text.slice(end));
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + e.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  async function submit() {
    const body = text.trim();
    if (!body && pending.length === 0) return;
    const atts = pending.map((p) => ({ assetId: p.assetId, width: p.width, height: p.height }));
    const rid = replyTo?.id ?? null;
    setText("");
    setPending([]);
    setReplyTo(null);
    await onSend(body, atts, rid);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-3">
        {messages.map((m) => (
          <MessageBubble key={m.id} m={m} meId={meId} onReply={setReplyTo} onEdit={onEdit} onUnsend={onUnsend} />
        ))}
        <div ref={bottomRef} />
      </div>

      {replyTo && (
        <div className="flex items-center gap-2 border-t border-line bg-canvas px-3 py-1.5 text-xs">
          <span className="min-w-0 flex-1 truncate text-muted">
            <span className="font-medium text-ink">{t("chat.replyingTo")}: </span>
            {replyTo.unsentAt ? t("chat.deleted") : replyTo.body || t("chat.photo")}
          </span>
          <button onClick={() => setReplyTo(null)} className="text-muted hover:text-ink" aria-label={t("common.close")}>
            ✕
          </button>
        </div>
      )}

      {pending.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-line px-3 py-2">
          {pending.map((p) => (
            <div key={p.assetId} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.previewUrl} alt="" className="h-14 w-14 rounded-lg border border-line object-cover" />
              <button
                onClick={() => setPending((cur) => cur.filter((x) => x.assetId !== p.assetId))}
                className="absolute -end-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-red-600 text-xs text-white"
                aria-label={t("common.remove")}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-1 border-t border-line p-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void addFiles(Array.from(e.target.files));
            e.target.value = "";
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          aria-label={t("chat.attachPhoto")}
          className="grid h-9 w-8 shrink-0 place-items-center text-muted hover:text-ink"
        >
          📎
        </button>
        <div className="relative" ref={emoji.ref}>
          <button
            onClick={() => emoji.setOpen((o) => !o)}
            aria-label={t("chat.emoji")}
            className="grid h-9 w-8 shrink-0 place-items-center text-muted hover:text-ink"
          >
            😊
          </button>
          {emoji.open && (
            <div className="absolute bottom-10 start-0 z-10">
              <EmojiPicker onPick={insertEmoji} />
            </div>
          )}
        </div>
        <textarea
          ref={taRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => {
            const files = Array.from(e.clipboardData.files);
            if (files.some((f) => f.type.startsWith("image/"))) {
              e.preventDefault();
              void addFiles(files);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder={t("chat.typeMessage")}
          className="input max-h-28 min-h-[2.25rem] flex-1 resize-none py-1.5"
        />
        <button
          onClick={submit}
          disabled={busy || (!text.trim() && pending.length === 0)}
          className="btn-primary btn-sm shrink-0"
        >
          {busy ? "…" : t("chat.send")}
        </button>
      </div>
    </div>
  );
}
