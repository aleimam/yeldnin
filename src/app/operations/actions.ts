"use server";
import { revalidatePath } from "next/cache";
import { requireModule } from "@/lib/auth/access";
import { pickUpTrip, convertTripToShipments, markShipmentPhotosSent } from "@/lib/operations/operations-service";
import { writeAudit } from "@/lib/audit";

export async function pickUpTripAction(tripId: number): Promise<void> {
  const access = await requireModule("operations", "OPERATE");
  await pickUpTrip(tripId, access.user.id);
  await writeAudit(access.user.id, "operations", "trip.pickup", "trip", tripId);
  revalidatePath(`/trips/${tripId}`);
}

export async function convertTripAction(tripId: number): Promise<void> {
  const access = await requireModule("operations", "OPERATE");
  const n = await convertTripToShipments(tripId, access.user.id);
  await writeAudit(access.user.id, "operations", "trip.convert", "trip", tripId, { shipments: n });
  revalidatePath(`/trips/${tripId}`);
  revalidatePath("/shipments");
}

export async function markShipmentPhotosSentAction(id: number): Promise<void> {
  const access = await requireModule("operations", "OPERATE");
  await markShipmentPhotosSent(id, access.user.id);
  await writeAudit(access.user.id, "operations", "shipment.photosSent", "shipment", id);
  revalidatePath(`/shipments/${id}`);
  revalidatePath("/shipments");
}
