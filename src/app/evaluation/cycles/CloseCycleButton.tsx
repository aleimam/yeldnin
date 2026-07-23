"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { closeCycleAction } from "./actions";

/** Confirm-then-close a review cycle. Closing freezes results (no re-open). */
export function CloseCycleButton({ cycleId }: { cycleId: number }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(t("eval.closeConfirm"))) return;
        const fd = new FormData();
        fd.set("id", String(cycleId));
        start(async () => {
          await closeCycleAction(fd);
          router.refresh();
        });
      }}
      className="btn-sm border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
    >
      {pending ? "…" : t("eval.closeCycle")}
    </button>
  );
}
