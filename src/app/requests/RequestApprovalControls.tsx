"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { AutoTextarea } from "@/components/AutoTextarea";
import { approveRequestAction, rejectRequestAction } from "./actions";

/** Approve / reject controls for a PENDING request (gated by order_requests.approve). */
export function RequestApprovalControls({ id }: { id: number }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const approve = () =>
    start(async () => {
      setError(null);
      const res = await approveRequestAction(id);
      if (res.ok) router.refresh();
      else setError(res.error ?? null);
    });

  const reject = () =>
    start(async () => {
      setError(null);
      const res = await rejectRequestAction(id, note.trim() || null);
      if (res.ok) router.refresh();
      else setError(res.error ?? null);
    });

  return (
    <div className="space-y-2">
      {error && <div className="alert alert-error">{error}</div>}
      {rejecting ? (
        <div className="space-y-2">
          <AutoTextarea
            placeholder={t("req.rejectReason")}
            value={note}
            autoFocus
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) reject(); }}
          />
          <div className="flex gap-2">
            <button onClick={reject} disabled={pending} className="btn-primary btn-sm">{t("req.confirmReject")}</button>
            <button onClick={() => setRejecting(false)} disabled={pending} className="btn-secondary btn-sm">{t("common.cancel")}</button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button onClick={approve} disabled={pending} className="btn-primary btn-sm">{t("req.approve")}</button>
          <button onClick={() => setRejecting(true)} disabled={pending} className="btn-secondary btn-sm">{t("req.reject")}</button>
        </div>
      )}
    </div>
  );
}
