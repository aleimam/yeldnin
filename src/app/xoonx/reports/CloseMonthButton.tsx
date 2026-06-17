"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { closeMonthAction } from "./actions";

export function CloseMonthButton({ month }: { month: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function close() {
    if (!confirm(t("xrep.closeConfirm"))) return;
    setErr(null);
    start(async () => {
      const r = await closeMonthAction(month);
      if (r.ok) router.refresh();
      else setErr(r.error);
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button onClick={close} disabled={pending} className="btn-primary">{pending ? "…" : t("xrep.close")}</button>
      {err && <span className="text-sm text-red-600">{err}</span>}
    </div>
  );
}
