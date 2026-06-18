"use server";
import { revalidatePath } from "next/cache";
import { requireCapability, requireUser, requireAdmin } from "@/lib/auth/access";
import { pickUpTrip, convertTripToShipments, markShipmentPhotosSent } from "@/lib/operations/operations-service";
import { teamsUserCanMark, validateMark, isReviewTeam, type ReviewTeam } from "@/lib/review/review-logic";
import { setTripMark } from "@/lib/review/review-service";
import { writeAudit } from "@/lib/audit";

export async function pickUpTripAction(tripId: number): Promise<void> {
  const access = await requireCapability("operations", "operate");
  await pickUpTrip(tripId, access.user.id);
  await writeAudit(access.user.id, "operations", "trip.pickup", "trip", tripId);
  revalidatePath(`/trips/${tripId}`);
}

/** One team's OK/Issue mark on a picked-up trip. */
export async function setTripMarkAction(input: {
  tripId: number;
  team: string;
  status: string;
  note?: string;
  photoIds?: string[];
}): Promise<{ ok: boolean; error?: string }> {
  const access = await requireUser();
  if (!isReviewTeam(input.team) || !teamsUserCanMark(access).includes(input.team as ReviewTeam)) {
    return { ok: false, error: "You can't mark for that team." };
  }
  const errs = validateMark(input);
  if (Object.keys(errs).length) return { ok: false, error: Object.values(errs)[0] };
  await setTripMark(input.tripId, input.team, input.status, input.note ?? null, input.photoIds ?? [], access.user.id);
  await writeAudit(access.user.id, "operations", "trip.mark", "trip", input.tripId, { team: input.team, status: input.status });
  revalidatePath(`/trips/${input.tripId}`);
  return { ok: true };
}

/** Admin approval: release the trip and split it into shipments. */
export async function approveTripAction(tripId: number): Promise<void> {
  const access = await requireAdmin();
  const n = await convertTripToShipments(tripId, access.user.id);
  await writeAudit(access.user.id, "operations", "trip.approve", "trip", tripId, { shipments: n });
  revalidatePath(`/trips/${tripId}`);
  revalidatePath("/shipments");
}

/** Admin hold: keep the trip for re-review (no conversion). */
export async function holdTripAction(tripId: number): Promise<void> {
  const access = await requireAdmin();
  await writeAudit(access.user.id, "operations", "trip.hold", "trip", tripId);
  revalidatePath(`/trips/${tripId}`);
}

export async function markShipmentPhotosSentAction(id: number): Promise<void> {
  const access = await requireCapability("operations", "operate");
  await markShipmentPhotosSent(id, access.user.id);
  await writeAudit(access.user.id, "operations", "shipment.photosSent", "shipment", id);
  revalidatePath(`/shipments/${id}`);
  revalidatePath("/shipments");
}
