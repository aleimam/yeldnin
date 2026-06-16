"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { pickUpTripAction } from "./actions";

/** Operations picks up a Ready-to-pickup trip. Conversion happens via the
 *  admin approval in the review section (TripReview). */
export function TripOpsButtons({ tripId, status }: { tripId: number; status: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  if (status !== "READY_TO_PICKUP") return null;
  return (
    <button
      onClick={() => start(async () => { await pickUpTripAction(tripId); router.refresh(); })}
      disabled={pending}
      className="btn-primary px-3 py-1.5 text-sm"
    >
      {pending ? "…" : t("trip.pickUp")}
    </button>
  );
}
