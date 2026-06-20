"use client";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n/client";
import { tickState, isEdited, type TickState } from "@/lib/chat/chat-logic";
import type { MessageRow } from "@/lib/chat/chat-service";

function hhmm(d: Date): string {
  const x = new Date(d);
  return `${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`;
}

function Ticks({ state }: { state: TickState }) {
  if (state === "none") return null;
  const blue = state === "read";
  const double = state !== "sent";
  return (
    <span className={`ms-1 ${blue ? "text-sky-400" : ""}`} aria-hidden>
      {double ? "✓✓" : "✓"}
    </span>
  );
}

export function MessageThread({
  meId,
  messages,
  onSend,
}: {
  meId: number;
  messages: MessageRow[];
  onSend: (body: string) => void | Promise<void>;
}) {
  const t = useT();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  function submit() {
    const body = text.trim();
    if (!body) return;
    setText("");
    void onSend(body);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-3">
        {messages.map((m) => {
          const mine = m.senderId === meId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-sm ${
                  mine ? "bg-brand text-brand-fg" : "bg-canvas text-ink"
                }`}
              >
                {m.unsentAt ? (
                  <span className="italic opacity-70">{t("chat.deleted")}</span>
                ) : (
                  <span className="whitespace-pre-wrap break-words">{m.body}</span>
                )}
                <span
                  className={`ms-2 inline-flex items-center align-middle text-[10px] ${
                    mine ? "text-brand-fg/70" : "text-muted"
                  }`}
                >
                  {isEdited(m) && <span className="me-1">{t("chat.edited")}</span>}
                  {hhmm(m.createdAt)}
                  {mine && <Ticks state={tickState(m, meId)} />}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-end gap-2 border-t border-line p-2">
        <textarea
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={t("chat.typeMessage")}
          className="input max-h-28 min-h-[2.25rem] flex-1 resize-none py-1.5"
        />
        <button onClick={submit} disabled={!text.trim()} className="btn-primary btn-sm shrink-0">
          {t("chat.send")}
        </button>
      </div>
    </div>
  );
}
