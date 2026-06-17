"use server";
import { revalidatePath } from "next/cache";
import { requireModule, requireAdmin } from "@/lib/auth/access";
import { validateTrip } from "@/lib/trips/trip-logic";
import { createTrip, advanceTrip, approveTrip, denyTrip } from "@/lib/trips/trip-service";
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
  const access = await requireModule("logistics", "OPERATE");
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

export async function advanceTripAction(id: number): Promise<void> {
  const access = await requireModule("logistics", "OPERATE");
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
