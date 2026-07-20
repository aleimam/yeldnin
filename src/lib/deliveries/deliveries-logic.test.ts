import { describe, it, expect } from "vitest";
import {
  isDeliveryStatus,
  isFailureReason,
  isDeliverySlot,
  isTerminal,
  isBouncing,
  canTransition,
  isBounceTransition,
  needsAttention,
  requiresFailureReason,
  validateStatusChange,
  piastresToEgp,
  egpToPiastres,
  isPrepaid,
  collectionMismatch,
  canSeeAllDeliveries,
  deliveryCourierFilter,
  canOperateDeliveries,
  FAILURE_REASONS,
} from "./deliveries-logic";
import type { AccessLike } from "@/lib/products/products-logic";

const mk = (mods: Record<string, string>, isAdmin = false): AccessLike => ({
  isAdmin,
  canModule: (k: string, level = "VIEW") => {
    if (isAdmin) return true;
    const order = ["NONE", "VIEW", "OPERATE", "MANAGE"];
    return order.indexOf(mods[k] ?? "NONE") >= order.indexOf(level);
  },
  can: (k: string) => isAdmin || (mods[k] ?? "NONE") !== "NONE",
});

describe("enums", () => {
  it("recognises statuses, slots and failure reasons", () => {
    expect(isDeliveryStatus("OUT_FOR_DELIVERY")).toBe(true);
    expect(isDeliveryStatus("SHIPPED")).toBe(false); // a Delivery is never a "shipment"
    expect(isDeliverySlot("14:00-18:00")).toBe(true);
    expect(isDeliverySlot("14:00-16:00")).toBe(false); // only the three 4-hour windows
    expect(isFailureReason("NO_CASH")).toBe(true);
  });
  it("has NO refusal code — refusing at the door is CANCELLED, not FAILED", () => {
    expect(FAILURE_REASONS).not.toContain("REFUSED");
    expect(isFailureReason("REFUSED")).toBe(false);
  });
});

describe("lifecycle", () => {
  it("closes on DELIVERED, FAILED and CANCELLED only", () => {
    expect(isTerminal("DELIVERED")).toBe(true);
    expect(isTerminal("FAILED")).toBe(true);
    expect(isTerminal("CANCELLED")).toBe(true);
    expect(isTerminal("DELAYED")).toBe(false);
    expect(isBouncing("RESCHEDULED")).toBe(true);
    expect(isBouncing("OUT_FOR_DELIVERY")).toBe(false);
  });

  it("keeps ASSIGNED and OUT_FOR_DELIVERY separate", () => {
    // The customer only ever sees the second one — "out for delivery" showing
    // for six hours in the Cairo summer reads as something having gone wrong.
    expect(canTransition("NEW", "ASSIGNED")).toBe(true);
    expect(canTransition("NEW", "OUT_FOR_DELIVERY")).toBe(false);
    expect(canTransition("ASSIGNED", "OUT_FOR_DELIVERY")).toBe(true);
  });

  it("lets a delivery bounce with no limit, but only back onto the road", () => {
    expect(canTransition("OUT_FOR_DELIVERY", "RESCHEDULED")).toBe(true);
    expect(canTransition("RESCHEDULED", "OUT_FOR_DELIVERY")).toBe(true);
    expect(canTransition("DELAYED", "OUT_FOR_DELIVERY")).toBe(true);
    expect(isBounceTransition("DELAYED", "OUT_FOR_DELIVERY")).toBe(true);
    expect(isBounceTransition("ASSIGNED", "OUT_FOR_DELIVERY")).toBe(false);
    // ...but a slipped delivery cannot jump straight to delivered
    expect(canTransition("RESCHEDULED", "DELIVERED")).toBe(false);
  });

  it("never reopens a closed delivery", () => {
    for (const to of ["ASSIGNED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"]) {
      expect(canTransition("DELIVERED", to)).toBe(false);
      expect(canTransition("CANCELLED", to)).toBe(false);
      expect(canTransition("FAILED", to)).toBe(false);
    }
  });

  it("allows cancelling an unassigned delivery", () => {
    // The contract text lists cancellation as accepted "while ASSIGNED or
    // OUT_FOR_DELIVERY". Taken literally that strands a NEW delivery whose order
    // was cancelled before anyone picked it up — it would have no legal exit.
    expect(canTransition("NEW", "CANCELLED")).toBe(true);
  });

  it("flags for attention after 3 bounces without blocking", () => {
    expect(needsAttention(2)).toBe(false);
    expect(needsAttention(3)).toBe(true);
    expect(canTransition("DELAYED", "OUT_FOR_DELIVERY")).toBe(true); // still legal at any count
  });
});

describe("validateStatusChange", () => {
  it("rejects an impossible move without complaining about its details", () => {
    const e = validateStatusChange({ from: "DELIVERED", to: "OUT_FOR_DELIVERY" });
    expect(e.status).toBe("This delivery is already closed.");
    expect(Object.keys(e)).toEqual(["status"]);
  });

  it("requires a reason CODE for FAILED, and forbids one elsewhere", () => {
    expect(requiresFailureReason("FAILED")).toBe(true);
    expect(validateStatusChange({ from: "OUT_FOR_DELIVERY", to: "FAILED" })).toHaveProperty("failureReason");
    expect(validateStatusChange({ from: "OUT_FOR_DELIVERY", to: "FAILED", failureReason: "NOT_HOME" })).toEqual({});
    expect(validateStatusChange({ from: "OUT_FOR_DELIVERY", to: "FAILED", failureReason: "he wasn't there" })).toHaveProperty("failureReason");
    expect(validateStatusChange({ from: "OUT_FOR_DELIVERY", to: "DELIVERED", failureReason: "NOT_HOME" })).toHaveProperty("failureReason");
  });

  it("makes a slipped delivery carry a NEW promise", () => {
    const bare = validateStatusChange({ from: "OUT_FOR_DELIVERY", to: "RESCHEDULED" });
    expect(bare).toHaveProperty("promisedDate");
    expect(bare).toHaveProperty("promisedSlot");
    expect(
      validateStatusChange({ from: "OUT_FOR_DELIVERY", to: "DELAYED", promisedDate: "2026-07-22", promisedSlot: "18:00-22:00" }),
    ).toEqual({});
  });

  it("needs a courier to become ASSIGNED", () => {
    expect(validateStatusChange({ from: "NEW", to: "ASSIGNED" })).toHaveProperty("courierId");
    expect(validateStatusChange({ from: "NEW", to: "ASSIGNED", courierId: 7 })).toEqual({});
  });
});

describe("money is integer piastres", () => {
  it("converts without accumulating float error", () => {
    expect(egpToPiastres(1450)).toBe(145000);
    expect(piastresToEgp(145000)).toBe(1450);
    expect(egpToPiastres(0.1 + 0.2)).toBe(30); // 0.30000000000000004 → 30, not 30.000000000000004
    expect(piastresToEgp(null)).toBeNull();
  });
  it("treats prepaid and zero-collect alike", () => {
    expect(isPrepaid(0, "COD")).toBe(true);
    expect(isPrepaid(145000, "PREPAID")).toBe(true);
    expect(isPrepaid(145000, "COD")).toBe(false);
  });
  it("spots a collection shortfall (the Yellow Flag trigger)", () => {
    expect(collectionMismatch(145000, 145000)).toBe(false);
    expect(collectionMismatch(145000, 90000)).toBe(true);
    expect(collectionMismatch(145000, 200000)).toBe(true); // over-collection matters too
    expect(collectionMismatch(145000, null)).toBe(false); // not yet recorded ≠ mismatch
  });
});

describe("access — a courier sees ONLY their own", () => {
  const ops = mk({ couriers: "OPERATE" });
  const opsViewer = mk({ couriers: "VIEW" });
  const courier = mk({ couriers: "OPERATE" }); // a courier who can do his job

  it("gives Ops and admins every delivery", () => {
    expect(canSeeAllDeliveries(ops, "MEMBER")).toBe(true);
    expect(canSeeAllDeliveries(opsViewer, "MEMBER")).toBe(true); // VIEW is enough to watch the queue
    expect(canSeeAllDeliveries(mk({}, true), "SUPER_ADMIN")).toBe(true);
    expect(deliveryCourierFilter(ops, "MEMBER", 4)).toBeNull(); // null = unfiltered
  });

  it("pins a THIRD_PARTY courier to their own id EVEN AT OPERATE", () => {
    // The trap this replaces: keying "sees everything" off OPERATE. A courier
    // needs OPERATE to update his own delivery's status, so that rule handed him
    // the entire queue — every customer's address, phone and cash amount — the
    // moment he was given enough permission to do his job.
    expect(canSeeAllDeliveries(courier, "THIRD_PARTY")).toBe(false);
    expect(deliveryCourierFilter(courier, "THIRD_PARTY", 4)).toBe(4);
    expect(canOperateDeliveries(courier, "THIRD_PARTY")).toBe(true); // still able to work
  });

  it("does not use roster membership as the discriminator", () => {
    // Ops staff are couriers too — they hold Courier rows and take deliveries
    // themselves — so "is on the roster" would wrongly narrow Ops to their own.
    expect(deliveryCourierFilter(ops, "MEMBER", 9)).toBeNull();
  });

  it("shows ZERO — not everything — to a courier who is not on the roster", () => {
    // The dangerous default: a filter of `null` here would mean "no filter".
    expect(deliveryCourierFilter(courier, "THIRD_PARTY", null)).toBe(-1);
  });
});
