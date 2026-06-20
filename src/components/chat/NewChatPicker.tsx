"use client";
import { useState } from "react";
import { useLocale, useT } from "@/i18n/client";
import { displayName } from "@/lib/users/users-logic";
import type { ChatablePerson } from "@/lib/chat/chat-service";

function avatarSrc(id: string | null): string | null {
  return id ? `/api/asset/${id}` : null;
}

export function NewChatPicker({
  people,
  onPick,
}: {
  people: ChatablePerson[];
  onPick: (p: ChatablePerson) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const [q, setQ] = useState("");
  const ql = q.trim().toLowerCase();
  const filtered = ql
    ? people.filter(
        (p) => displayName(p, locale).toLowerCase().includes(ql) || p.name.toLowerCase().includes(ql),
      )
    : people;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line p-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("chat.searchUsers")}
          className="input h-9 py-1.5"
          autoFocus
        />
      </div>
      <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
        {filtered.map((p) => {
          const name = displayName(p, locale);
          const src = avatarSrc(p.avatarUrl);
          return (
            <li key={p.id}>
              <button
                onClick={() => onPick(p)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-start hover:bg-canvas"
              >
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-canvas text-xs text-muted">
                    {name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="truncate text-sm text-ink">{name}</span>
                {p.recent && <span className="ms-auto shrink-0 text-[10px] text-muted">{t("chat.recent")}</span>}
              </button>
            </li>
          );
        })}
        {!filtered.length && <li className="px-3 py-6 text-center text-sm text-muted">{t("chat.noUsers")}</li>}
      </ul>
    </div>
  );
}
