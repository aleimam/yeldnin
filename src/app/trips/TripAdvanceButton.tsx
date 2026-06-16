"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { nextTripStatus } from "@/lib/trips/trip-logic";
import { advanceTripAction } from "./actions";

/** Advance a trip to its next status (cascading item statuses where applicable). */
export function TripAdvanceButton({ id, status }: { id: number; status: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const next = nextTripStatus(status);
  if (!next) return <span className="text-sm text-muted">{t(`tripstatus.${status}`)}</span>;

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
