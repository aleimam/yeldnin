"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { lookupItemAction } from "./actions";

/** Find an item by UID and jump to its history timeline. */
export function HistorySearch() {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [uid, setUid] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await lookupItemAction(uid);
      if (res.id) router.push(`/history/items/${res.id}`);
      else setError(t("history.notFound"));
    });
  }

  return (
    <form onSubmit={submit} className="mb-4 flex max-w-md items-center gap-2">
      <input className="input" placeholder={t("history.search")} value={uid} onChange={(e) => setUid(e.target.value)} />
      <button type="submit" disabled={pending} className="btn-primary">{pending ? "…" : t("history.searchBtn")}</button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </form>
  );
}
