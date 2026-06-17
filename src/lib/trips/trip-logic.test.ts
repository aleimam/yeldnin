import { describe, it, expect } from "vitest";
import { nextTripStatus, TRIP_TO_ITEM_STATUS, isTripPurchaseEligible, validateTrip, canManuallyAdvance } from "./trip-logic";

describe("trip status flow", () => {
  it("advances linearly and stops at READY_TO_PICKUP", () => {
    expect(nextTripStatus("NEW")).toBe("APPROVED");
    expect(nextTripStatus("IN_EGYPT")).toBe("READY_TO_PICKUP");
    expect(nextTripStatus("READY_TO_PICKUP")).toBeNull();
  });
  it("cascades only In-Egypt and Ready-to-pickup", () => {
    expect(TRIP_TO_ITEM_STATUS.IN_EGYPT).toBe("CUSTOMS");
    expect(TRIP_TO_ITEM_STATUS.READY_TO_PICKUP).toBe("OUT_FOR_DELIVERY");
    expect(TRIP_TO_ITEM_STATUS.NEW).toBeUndefined();
  });
  it("manual advance excludes NEW, APPROVED, and terminal statuses", () => {
    expect(canManuallyAdvance("NEW")).toBe(false);
    expect(canManuallyAdvance("APPROVED")).toBe(false);
    expect(canManuallyAdvance("STARTED_SHIPPING")).toBe(true);
    expect(canManuallyAdvance("IN_EGYPT")).toBe(true);
    expect(canManuallyAdvance("READY_TO_PICKUP")).toBe(false);
    expect(canManuallyAdvance("CANCELLED")).toBe(false);
  });
});

describe("purchase eligibility", () => {
  const now = new Date("2026-06-16T12:00:00Z");
  const future = "2026-06-20T00:00:00Z";
  const past = "2026-06-10T00:00:00Z";
  it("needs Approved/Started Shipping + a future last-receiving date", () => {
    expect(isTripPurchaseEligible({ status: "APPROVED", lastReceivingDate: future }, now)).toBe(true);
    expect(isTripPurchaseEligible({ status: "STARTED_SHIPPING", lastReceivingDate: future }, now)).toBe(true);
    expect(isTripPurchaseEligible({ status: "NEW", lastReceivingDate: future }, now)).toBe(false);
    expect(isTripPurchaseEligible({ status: "APPROVED", lastReceivingDate: past }, now)).toBe(false);
    expect(isTripPurchaseEligible({ status: "APPROVED", lastReceivingDate: null }, now)).toBe(false);
  });
  it("today does not count (must be strictly future)", () => {
    expect(isTripPurchaseEligible({ status: "APPROVED", lastReceivingDate: "2026-06-16T20:00:00Z" }, now)).toBe(false);
  });
});

describe("validateTrip", () => {
  it("requires a traveler and country", () => {
    expect(validateTrip({ travelerId: null, country: "Egypt" })).toHaveProperty("traveler");
    expect(validateTrip({ travelerId: 1, country: "" })).toHaveProperty("country");
    expect(validateTrip({ travelerId: 1, country: "USA" })).toEqual({});
  });
  it("delivery-in-Egypt must be after the last-receiving date", () => {
    const base = { travelerId: 1, country: "USA" };
    expect(validateTrip({ ...base, lastReceivingDate: "2026-07-01", deliveryDateInEgypt: "2026-07-10" })).toEqual({});
    expect(validateTrip({ ...base, lastReceivingDate: "2026-07-10", deliveryDateInEgypt: "2026-07-01" })).toHaveProperty("deliveryDateInEgypt");
    expect(validateTrip({ ...base, lastReceivingDate: "2026-07-10", deliveryDateInEgypt: "2026-07-10" })).toHaveProperty("deliveryDateInEgypt");
    // only one date present → no constraint
    expect(validateTrip({ ...base, deliveryDateInEgypt: "2026-07-01" })).toEqual({});
  });
});
