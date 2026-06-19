"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { decideLeaveAction } from "../attendance-actions";

export function LeaveDecideButtons({ id }: { id: number }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (approve: boolean) => start(async () => { await decideLeaveAction(id, approve, null); router.refresh(); });
  return (
    <span className="flex justify-end gap-1.5">
      <button type="button" className="btn-primary px-2 py-1 text-xs" disabled={pending} onClick={() => run(true)}>{t("leave.approve")}</button>
      <button type="button" className="btn-danger px-2 py-1 text-xs" disabled={pending} onClick={() => run(false)}>{t("leave.decline")}</button>
    </span>
  );
}
