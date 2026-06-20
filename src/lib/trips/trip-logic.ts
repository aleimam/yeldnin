// Pure trip logic. No DB/IO. Unit-tested.

// Lifecycle up to READY_TO_PICKUP. PICKED_UP onward is handled by Operations.
export const TRIP_STATUSES = [
  "NEW",
  "APPROVED",
  "STARTED_SHIPPING",
  "COMPLETED_SHIPPING",
  "COMPLETED_RECEIVING",
  "WAITING_TRIP",
  "TRAVELING",
  "IN_EGYPT",
  "READY_TO_PICKUP",
] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

export function nextTripStatus(s: string): TripStatus | null {
  const i = (TRIP_STATUSES as readonly string[]).indexOf(s);
  return i >= 0 && i < TRIP_STATUSES.length - 1 ? TRIP_STATUSES[i + 1] : null;
}

// Statuses an operator may advance by hand. NEW uses admin Approve/Deny;
// APPROVED → STARTED_SHIPPING happens automatically on the first purchase;
// CANCELLED and READY_TO_PICKUP are terminal.
const MANUAL_ADVANCE_FROM: ReadonlySet<string> = new Set([
  "STARTED_SHIPPING",
  "COMPLETED_SHIPPING",
  "COMPLETED_RECEIVING",
  "WAITING_TRIP",
  "TRAVELING",
  "IN_EGYPT",
]);
export function canManuallyAdvance(status: string): boolean {
  return MANUAL_ADVANCE_FROM.has(status) && nextTripStatus(status) !== null;
}

/** Trip status → item status it cascades (only these steps move items). */
export const TRIP_TO_ITEM_STATUS: Partial<Record<TripStatus, string>> = {
  IN_EGYPT: "CUSTOMS",
  READY_TO_PICKUP: "OUT_FOR_DELIVERY",
};

/** Trips that can receive purchases: Approved/Started Shipping + future date. */
export function isTripPurchaseEligible(
  trip: { status: string; lastReceivingDate?: Date | string | null },
  now: Date,
): boolean {
  if (trip.status !== "APPROVED" && trip.status !== "STARTED_SHIPPING") return false;
  if (!trip.lastReceivingDate) return false;
  const d = new Date(trip.lastReceivingDate);
  // Must be strictly after today (not today, not in the past). UTC end-of-day so
  // the boundary is timezone-stable, consistent with the rest of the date logic.
  const endOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999);
  return d.getTime() > endOfToday;
}

export function validateTrip(input: {
  travelerId?: number | null;
  country?: string;
  lastReceivingDate?: string | null;
  deliveryDateInEgypt?: string | null;
}): Record<string, string> {
  const e: Record<string, string> = {};
  if (!input.travelerId) e.traveler = "Choose a traveler.";
  if (!input.country?.trim()) e.country = "Country is required.";
  if (input.lastReceivingDate && input.deliveryDateInEgypt) {
    if (new Date(input.deliveryDateInEgypt).getTime() <= new Date(input.lastReceivingDate).getTime()) {
      e.deliveryDateInEgypt = "Delivery date in Egypt must be after the last receiving date.";
    }
  }
  return e;
}
