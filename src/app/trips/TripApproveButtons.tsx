"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { approveTripAction, denyTripAction } from "./actions";

/** Admin Approve / Deny for a NEW trip. Deny cancels the trip (CANCELLED). */
export function TripApproveButtons({ id }: { id: number }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        className="btn-primary px-3 py-1.5 text-sm"
        onClick={() => start(async () => { await approveTripAction(id); router.refresh(); })}
      >
        {t("trip.approve")}
      </button>
      <button
        type="button"
        disabled={pending}
        className="btn-secondary px-3 py-1.5 text-sm text-red-600"
        onClick={() => {
          if (!confirm(t("trip.denyConfirm"))) return;
          start(async () => { await denyTripAction(id); router.refresh(); });
        }}
      >
        {t("trip.deny")}
      </button>
    </span>
  );
}
