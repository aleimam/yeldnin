import { describe, it, expect } from "vitest";
import {
  TRANSFER_STATUSES,
  nextTransferStatus,
  canAdvanceTransfer,
  isTransferEndpoint,
  validateTransfer,
} from "./transfer-logic";

describe("transfer-logic", () => {
  it("advances NEW → LEFT_ORIGIN → DELIVERED → RECEIVED then stops", () => {
    expect(TRANSFER_STATUSES).toEqual(["NEW", "LEFT_ORIGIN", "DELIVERED", "RECEIVED"]);
    expect(nextTransferStatus("NEW")).toBe("LEFT_ORIGIN");
    expect(nextTransferStatus("LEFT_ORIGIN")).toBe("DELIVERED");
    expect(nextTransferStatus("DELIVERED")).toBe("RECEIVED");
    expect(nextTransferStatus("RECEIVED")).toBeNull();
    expect(nextTransferStatus("BOGUS")).toBeNull();
    expect(canAdvanceTransfer("DELIVERED")).toBe(true);
    expect(canAdvanceTransfer("RECEIVED")).toBe(false);
  });

  it("recognizes the endpoint types", () => {
    for (const t of ["HUB", "TRIP", "TRAVELER"]) expect(isTransferEndpoint(t)).toBe(true);
    expect(isTransferEndpoint("REQUEST")).toBe(false);
    expect(isTransferEndpoint(null)).toBe(false);
  });

  it("accepts a valid same-country transfer", () => {
    const e = validateTransfer({ fromType: "HUB", fromId: 1, toType: "TRIP", toId: 2, fromCountry: "USA", toCountry: "USA", itemCount: 3 });
    expect(Object.keys(e)).toHaveLength(0);
  });

  it("requires both endpoints, distinctness, same country, and items", () => {
    expect(validateTransfer({ itemCount: 1 }).from).toBeTruthy();
    expect(validateTransfer({ fromType: "HUB", fromId: 1, itemCount: 1 }).to).toBeTruthy();
    // same endpoint → must differ
    expect(validateTransfer({ fromType: "HUB", fromId: 1, toType: "HUB", toId: 1, itemCount: 1 }).to).toBeTruthy();
    // cross-country blocked
    expect(validateTransfer({ fromType: "HUB", fromId: 1, toType: "HUB", toId: 2, fromCountry: "USA", toCountry: "UK", itemCount: 1 }).country).toBeTruthy();
    // no items
    expect(validateTransfer({ fromType: "HUB", fromId: 1, toType: "HUB", toId: 2, fromCountry: "USA", toCountry: "USA", itemCount: 0 }).items).toBeTruthy();
  });
});
