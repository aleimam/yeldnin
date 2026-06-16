"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { pickUpTripAction, convertTripAction } from "./actions";

/** Operations controls on a trip: Pick up (Ready→Picked up), then Convert to shipments. */
export function TripOpsButtons({ tripId, status }: { tripId: number; status: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: (id: number) => Promise<void>) => start(async () => { await fn(tripId); router.refresh(); });

  if (status === "READY_TO_PICKUP")
    return <button onClick={() => run(pickUpTripAction)} disabled={pending} className="btn-primary px-3 py-1.5 text-sm">{pending ? "…" : t("trip.pickUp")}</button>;
  if (status === "PICKED_UP")
    return <button onClick={() => run(convertTripAction)} disabled={pending} className="btn-primary px-3 py-1.5 text-sm">{pending ? "…" : t("trip.convert")}</button>;
  return null;
}
