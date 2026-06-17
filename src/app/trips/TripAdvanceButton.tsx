"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { nextTripStatus, canManuallyAdvance } from "@/lib/trips/trip-logic";
import { advanceTripAction } from "./actions";

/** Manual advance for mid-lifecycle trips (Started Shipping → … → Ready to pickup).
 *  NEW uses admin Approve/Deny; APPROVED → Started Shipping auto-starts on the
 *  first purchase, so neither shows a manual advance. */
export function TripAdvanceButton({ id, status }: { id: number; status: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const next = nextTripStatus(status);
  if (!canManuallyAdvance(status) || !next) return null;

  return (
    <button
      onClick={() => start(async () => { await advanceTripAction(id); router.refresh(); })}
      disabled={pending}
      className="btn-primary px-3 py-1.5 text-sm"
    >
      {pending ? "…" : `${t("trip.advanceTo")} ${t(`tripstatus.${next}`)}`}
    </button>
  );
}
