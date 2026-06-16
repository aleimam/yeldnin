"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { markPatchDeliveredAction, markPatchReceivedAction } from "./actions";

/** Advance a patch DISPATCHED → DELIVERED → RECEIVED (each step advances its items). */
export function PatchStatusButtons({ id, status }: { id: number; status: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();

  if (status === "RECEIVED") return <span className="text-sm text-green-600">{t("patches.received")}</span>;

  const run = (fn: (id: number) => Promise<void>) => start(async () => { await fn(id); router.refresh(); });

  return (
    <div className="flex items-center gap-3">
      {status === "DISPATCHED" && (
        <button onClick={() => run(markPatchDeliveredAction)} disabled={pending} className="btn-primary px-3 py-1.5 text-sm">
          {pending ? "…" : t("patches.markDelivered")}
        </button>
      )}
      {status === "DELIVERED" && (
        <button onClick={() => run(markPatchReceivedAction)} disabled={pending} className="btn-primary px-3 py-1.5 text-sm">
          {pending ? "…" : t("patches.markReceived")}
        </button>
      )}
    </div>
  );
}
