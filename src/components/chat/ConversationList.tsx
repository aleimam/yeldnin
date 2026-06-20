"use client";
import { useLocale, useT } from "@/i18n/client";
import { displayName } from "@/lib/users/users-logic";
import type { ConversationRow, ChatUserLite } from "@/lib/chat/chat-service";

function avatarSrc(id: string | null): string | null {
  return id ? `/api/asset/${id}` : null;
}
function hhmm(d: Date): string {
  const x = new Date(d);
  return `${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`;
}

export function ConversationList({
  rows,
  onOpen,
}: {
  rows: ConversationRow[];
  onOpen: (id: number, other: ChatUserLite) => void;
}) {
  const t = useT();
  const locale = useLocale();

  if (!rows.length) {
    return <p className="grid h-full place-items-center px-6 text-center text-sm text-muted">{t("chat.empty")}</p>;
  }

  return (
    <ul className="h-full divide-y divide-line overflow-y-auto">
      {rows.map((r) => {
        const name = displayName(r.other, locale);
        const src = avatarSrc(r.other.avatarUrl);
        const preview = r.lastUnsent
          ? t("chat.deleted")
          : r.lastHasPhoto && !r.lastBody
            ? t("chat.photo")
            : r.lastBody;
        return (
          <li key={r.id}>
            <button
              onClick={() => onOpen(r.id, r.other)}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-start hover:bg-canvas"
            >
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-canvas text-sm text-muted">
                  {name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={`truncate text-sm text-ink ${r.unread ? "font-bold" : "font-medium"}`}>{name}</span>
                  <span className="shrink-0 text-[10px] text-muted">{hhmm(r.lastAt)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className={`truncate text-xs ${r.unread ? "text-ink" : "text-muted"}`}>
                    {r.lastFromMe && preview ? `${t("chat.you")}: ${preview}` : preview}
                  </span>
                  {r.unread > 0 && (
                    <span className="grid h-4 min-w-[1rem] shrink-0 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-medium text-white">
                      {r.unread > 9 ? "9+" : r.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
