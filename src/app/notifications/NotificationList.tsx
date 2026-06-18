"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useT } from "@/i18n/client";
import { markReadAction, markAllReadAction } from "./actions";

export interface Item {
  id: number;
  title: string;
  body: string;
  link: string | null;
  imageUrl: string | null;
  type: string;
  date: string;
  read: boolean;
}

const TONE: Record<string, string> = {
  info: "border-line",
  warning: "border-amber-400 bg-amber-50",
  success: "border-green-400 bg-green-50",
};

export function NotificationList({ items: initial }: { items: Item[] }) {
  const t = useT();
  const [items, setItems] = useState(initial);
  const [, start] = useTransition();
  const anyUnread = items.some((i) => !i.read);

  function open(i: Item) {
    if (i.read) return;
    setItems((p) => p.map((x) => (x.id === i.id ? { ...x, read: true } : x)));
    start(() => void markReadAction(i.id));
  }
  function allRead() {
    setItems((p) => p.map((x) => ({ ...x, read: true })));
    start(() => void markAllReadAction());
  }

  if (!items.length) return <p className="text-sm text-muted">{t("notif.empty")}</p>;

  return (
    <div className="max-w-2xl space-y-3">
      {anyUnread && (
        <button onClick={allRead} className="text-sm text-brand hover:underline">{t("notif.markAllRead")}</button>
      )}
      {items.map((i) => {
        const inner = (
          <div className={`card flex gap-3 p-4 ${i.read ? "opacity-60" : ""} ${TONE[i.type] ?? "border-line"}`}>
            {i.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={i.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-semibold text-ink">
                  {!i.read && <span className="me-1.5 inline-block h-2 w-2 rounded-full bg-brand align-middle" />}
                  {i.title}
                </p>
                <span className="shrink-0 text-xs text-muted">{i.date}</span>
              </div>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted">{i.body}</p>
            </div>
          </div>
        );
        return i.link ? (
          <Link key={i.id} href={i.link} onClick={() => open(i)} className="block">{inner}</Link>
        ) : (
          <button key={i.id} type="button" onClick={() => open(i)} className="block w-full text-start">{inner}</button>
        );
      })}
    </div>
  );
}
