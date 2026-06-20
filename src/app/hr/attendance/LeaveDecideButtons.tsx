"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { decideLeaveAction } from "../attendance-actions";

export function LeaveDecideButtons({ id }: { id: number }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const run = (approve: boolean) =>
    start(async () => {
      setErr(null);
      const res = await decideLeaveAction(id, approve, null);
      if (!res.ok) { setErr(t(res.error)); return; }
      router.refresh();
    });
  return (
    <span className="flex flex-col items-end gap-1">
      <span className="flex gap-1.5">
        <button type="button" className="btn-primary px-2 py-1 text-xs" disabled={pending} onClick={() => run(true)}>{t("leave.approve")}</button>
        <button type="button" className="btn-danger px-2 py-1 text-xs" disabled={pending} onClick={() => run(false)}>{t("leave.decline")}</button>
      </span>
      {err && <span className="text-[11px] text-red-600">{err}</span>}
    </span>
  );
}
