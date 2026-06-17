"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { formatBizDate } from "@/lib/format/dates";
import { markDeliveredAction } from "./actions";

export function DeliverButton({ id, deliveredAt }: { id: number; deliveredAt: string | null }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const toggle = (delivered: boolean) =>
    start(async () => {
      setErr(null);
      const r = await markDeliveredAction(id, delivered);
      if (r.ok) router.refresh();
      else setErr(r.error ?? "Error");
    });

  return (
    <div className="flex flex-wrap items-center gap-3">
      {deliveredAt ? (
        <>
          <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600">✓ {t("xreq.delivered")} · {formatBizDate(deliveredAt)}</span>
          <button onClick={() => toggle(false)} disabled={pending} className="text-xs text-muted hover:underline">{t("xreq.undeliver")}</button>
        </>
      ) : (
        <button onClick={() => toggle(true)} disabled={pending} className="btn-primary">{pending ? "…" : t("xreq.markDelivered")}</button>
      )}
      {err && <span className="text-sm text-red-600">{err}</span>}
    </div>
  );
}
