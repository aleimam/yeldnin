"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { pruneErrorLogsAction, clearErrorLogsAction } from "./actions";

/** Admin maintenance: prune old rows (30-day) or clear the whole log. */
export function ErrorLogToolbar() {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  const prune = () =>
    start(async () => {
      const res = await pruneErrorLogsAction();
      if (res.ok) { setNote(t("errlog.pruned", { n: res.deleted ?? 0 })); router.refresh(); }
    });

  const clearAll = () =>
    start(async () => {
      if (!confirm(t("errlog.confirmClear"))) return;
      const res = await clearErrorLogsAction();
      if (res.ok) { setNote(t("errlog.cleared", { n: res.deleted ?? 0 })); router.refresh(); }
    });

  return (
    <div className="flex items-center gap-2">
      {note && <span className="text-xs text-muted">{note}</span>}
      <button onClick={prune} disabled={pending} className="btn-secondary btn-sm">{t("errlog.prune")}</button>
      <button onClick={clearAll} disabled={pending} className="btn-secondary btn-sm text-red-600">{t("errlog.clear")}</button>
    </div>
  );
}
