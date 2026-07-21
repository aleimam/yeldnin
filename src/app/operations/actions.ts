"use server";
import { revalidatePath } from "next/cache";
import { requireCapability, requireUser, requireAdmin } from "@/lib/auth/access";
import {
  pickUpTrip, convertTripToShipments, markShipmentPhotosSent, markShipmentOnWebsite,
  setShipmentItemsExpiry, addShipmentPhoto, removeShipmentPhoto,
} from "@/lib/operations/operations-service";
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

// ─── Incoming Shipments: Ops enter stock-in data before Veeey Sales approve ───

/**
 * Apply one expiry / lot to the selected units of a shipment. Expiry is per
 * unit, but Ops usually set one value across a whole product's units, so the
 * client selects and this writes the batch. An empty date clears it (a device
 * has no expiry) rather than being rejected.
 */
export async function setShipmentItemsExpiryAction(input: {
  shipmentId: number;
  itemIds: number[];
  expiry: string | null;
  lotCode: string | null;
}): Promise<{ updated: number }> {
  const access = await requireCapability("operations", "operate");
  const raw = input.expiry?.trim();
  const parsed = raw ? new Date(raw) : null;
  // Refuse an unparseable date rather than silently storing null — a typo must
  // not read as "no expiry" on stock that has one.
  if (raw && (!parsed || Number.isNaN(parsed.getTime()))) throw new Error("invalid_expiry");
  const updated = await setShipmentItemsExpiry(input.shipmentId, input.itemIds, {
    expiryDate: parsed,
    lotCode: input.lotCode?.trim() || null,
  });
  await writeAudit(access.user.id, "operations", "shipment.itemsExpiry", "shipment", input.shipmentId, {
    count: updated,
    expiry: parsed ? parsed.toISOString().slice(0, 10) : null,
    lotCode: input.lotCode?.trim() || null,
  });
  revalidatePath(`/shipments/${input.shipmentId}`);
  return { updated };
}

export async function addShipmentPhotoAction(shipmentId: number, assetId: string): Promise<void> {
  const access = await requireCapability("operations", "operate");
  await addShipmentPhoto(shipmentId, assetId);
  await writeAudit(access.user.id, "operations", "shipment.photoAdd", "shipment", shipmentId);
  revalidatePath(`/shipments/${shipmentId}`);
}

export async function removeShipmentPhotoAction(shipmentId: number, photoId: number): Promise<void> {
  const access = await requireCapability("operations", "operate");
  await removeShipmentPhoto(shipmentId, photoId);
  await writeAudit(access.user.id, "operations", "shipment.photoRemove", "shipment", shipmentId, { photoId });
  revalidatePath(`/shipments/${shipmentId}`);
}

/** Ops mark the shipment In Website → items become stock and Veeey is told what
 *  arrived (its Sales then approve it into sellable lots). */
export async function markShipmentOnWebsiteAction(id: number): Promise<void> {
  const access = await requireCapability("operations", "operate");
  await markShipmentOnWebsite(id, access.user.id);
  await writeAudit(access.user.id, "operations", "shipment.onWebsite", "shipment", id);
  revalidatePath(`/shipments/${id}`);
  revalidatePath("/shipments");
}
