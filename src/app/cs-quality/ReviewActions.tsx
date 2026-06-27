"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { AutoTextarea } from "@/components/AutoTextarea";
import { approveCsEvaluationAction, rejectCsEvaluationAction } from "./actions";

/** Inline Approve / Reject (with reason) for a pending evaluation. Used on the
 *  evaluation detail page and per-row in the review queue. */
export function ReviewActions({ id }: { id: number }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => start(async () => { await approveCsEvaluationAction(id); router.refresh(); })}
        disabled={pending}
        className="btn-primary px-3 py-1.5 text-sm"
      >
        {t("cs.approve")}
      </button>
      {!rejecting ? (
        <button onClick={() => setRejecting(true)} disabled={pending} className="btn-secondary px-3 py-1.5 text-sm">{t("cs.reject")}</button>
      ) : (
        <span className="flex items-center gap-2">
          <AutoTextarea
            className="w-48 text-sm"
            placeholder={t("cs.rejectReason")}
            value={note}
            autoFocus
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); start(async () => { await rejectCsEvaluationAction(id, note); router.refresh(); }); } }}
          />
          <button
            onClick={() => start(async () => { await rejectCsEvaluationAction(id, note); router.refresh(); })}
            disabled={pending}
            className="btn-secondary px-3 py-1.5 text-sm text-red-600"
          >
            {t("cs.confirmReject")}
          </button>
        </span>
      )}
    </div>
  );
}
