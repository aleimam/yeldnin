"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { reviewShipmentAction } from "./actions";

/**
 * Sales' sign-off on an incoming shipment, mirroring the same screen in Veeey
 * (owner decision — either app may decide, and whichever does tells the other).
 *
 * Only offered on a WEBSITE shipment: approving one still in the office would
 * stock goods Veeey has never been told about. A send-back needs a reason, since
 * Ops have to know what to fix.
 */
export function ShipmentReviewControl({
  id, status, reviewStatus, reviewNote,
}: { id: number; status: string; reviewStatus: string | null; reviewNote: string | null }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (reviewStatus) {
    return (
      <div className="card p-5 text-sm">
        <div className="text-ink">
          {reviewStatus === "APPROVED" ? t("shipments.reviewedApproved") : t("shipments.reviewedRejected")}
        </div>
        {reviewNote && <div className="mt-1 text-muted">{reviewNote}</div>}
      </div>
    );
  }
  if (status !== "WEBSITE") return null;

  const run = (decision: "APPROVED" | "REJECTED") =>
    start(async () => {
      setError(null);
      const r = await reviewShipmentAction(id, decision, decision === "REJECTED" ? reason : null);
      if (r.ok) router.refresh();
      else setError(r.skipped ?? "failed");
    });

  return (
    <div className="card space-y-3 p-5">
      <div className="text-sm font-medium text-ink">{t("shipments.review")}</div>
      <p className="text-xs text-muted">{t("shipments.reviewHint")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => run("APPROVED")} disabled={pending} className="btn-primary px-3 py-1.5 text-sm disabled:opacity-50">
          {pending ? "…" : t("shipments.approve")}
        </button>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("shipments.sendBackReason")}
          className="input w-72 text-sm"
        />
        <button
          onClick={() => run("REJECTED")}
          disabled={pending || !reason.trim()}
          className="rounded-md border border-red-500 px-3 py-1.5 text-sm text-red-600 disabled:opacity-50"
        >
          {t("shipments.sendBack")}
        </button>
      </div>
      {error && <div className="text-xs text-red-600">{error}</div>}
    </div>
  );
}
