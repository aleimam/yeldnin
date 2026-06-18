"use server";
import { revalidatePath } from "next/cache";
import { requireCapability, requireAdmin, requireUser } from "@/lib/auth/access";
import { validateTrip } from "@/lib/trips/trip-logic";
import { createTrip, updateTrip, advanceTrip, approveTrip, denyTrip, getTrip } from "@/lib/trips/trip-service";
import { writeAudit } from "@/lib/audit";

export interface TripPayload {
  travelerId: number | null;
  country: string;
  maxWeight?: number | null;
  dealPricePerKg?: number | null;
  lastReceivingDate?: string | null;
  deliveryDateInEgypt?: string | null;
  notes?: string;
  allowedProductTypes?: string[];
  handlingFee?: number | null;
  handlingFeeCurrency?: string | null;
}
export type TripResult = { ok: true; id: number } | { ok: false; error: string };

export async function createTripAction(p: TripPayload): Promise<TripResult> {
  const access = await requireCapability("logistics", "operate");
  const errs = validateTrip(p);
  if (Object.keys(errs).length) return { ok: false, error: Object.values(errs)[0] };
  try {
    const trip = await createTrip(
      {
        travelerId: p.travelerId!,
        country: p.country,
        maxWeight: p.maxWeight ?? null,
        dealPricePerKg: p.dealPricePerKg ?? null,
        lastReceivingDate: p.lastReceivingDate ?? null,
        deliveryDateInEgypt: p.deliveryDateInEgypt ?? null,
        notes: p.notes ?? null,
        allowedProductTypes: p.allowedProductTypes ?? [],
        handlingFee: p.handlingFee ?? null,
        handlingFeeCurrency: p.handlingFeeCurrency ?? null,
      },
      access.user.id,
    );
    await writeAudit(access.user.id, "logistics", "trip.create", "trip", trip.id, { travelerId: p.travelerId });
    revalidatePath("/trips");
    return { ok: true, id: trip.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not create the trip." };
  }
}

/** Edit trip details — the trip's creator or an admin, any status (no lock). */
export async function updateTripAction(id: number, p: TripPayload): Promise<TripResult> {
  const access = await requireUser();
  const trip = await getTrip(id);
  if (!trip) return { ok: false, error: "Trip not found." };
  if (!access.isAdmin && trip.createdById !== access.user.id) {
    return { ok: false, error: "You can only edit trips you created." };
  }
  const errs = validateTrip(p);
  if (Object.keys(errs).length) return { ok: false, error: Object.values(errs)[0] };
  try {
    await updateTrip(
      id,
      {
        travelerId: p.travelerId!,
        country: p.country,
        maxWeight: p.maxWeight ?? null,
        dealPricePerKg: p.dealPricePerKg ?? null,
        lastReceivingDate: p.lastReceivingDate ?? null,
        deliveryDateInEgypt: p.deliveryDateInEgypt ?? null,
        notes: p.notes ?? null,
        allowedProductTypes: p.allowedProductTypes ?? [],
        handlingFee: p.handlingFee ?? null,
        handlingFeeCurrency: p.handlingFeeCurrency ?? null,
      },
      access.user.id,
    );
    await writeAudit(access.user.id, "logistics", "trip.update", "trip", id, { travelerId: p.travelerId });
    revalidatePath(`/trips/${id}`);
    revalidatePath("/trips");
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not update the trip." };
  }
}

export async function advanceTripAction(id: number): Promise<void> {
  const access = await requireCapability("logistics", "operate");
  await advanceTrip(id, access.user.id);
  await writeAudit(access.user.id, "logistics", "trip.advance", "trip", id);
  revalidatePath(`/trips/${id}`);
  revalidatePath("/trips");
}

/** Admin approves a NEW trip → Approved. */
export async function approveTripAction(id: number): Promise<void> {
  const access = await requireAdmin();
  await approveTrip(id, access.user.id);
  await writeAudit(access.user.id, "logistics", "trip.approve", "trip", id);
  revalidatePath(`/trips/${id}`);
  revalidatePath("/trips");
}

/** Admin denies a NEW trip → Cancelled. */
export async function denyTripAction(id: number): Promise<void> {
  const access = await requireAdmin();
  await denyTrip(id, access.user.id);
  await writeAudit(access.user.id, "logistics", "trip.deny", "trip", id);
  revalidatePath(`/trips/${id}`);
  revalidatePath("/trips");
}
