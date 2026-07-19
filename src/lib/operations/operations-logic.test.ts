import { describe, it, expect } from "vitest";
import {
  splitTripIntoShipments,
  type SplitItem,
  MAX_PER_SHIPMENT,
  MAX_SAME_PRODUCT,
} from "./operations-logic";

let nextId = 1;
function items(spec: { scope: string; type: string; productId: number; n: number }[]): SplitItem[] {
  const out: SplitItem[] = [];
  for (const s of spec) for (let i = 0; i < s.n; i++) out.push({ id: nextId++, scope: s.scope, type: s.type, productId: s.productId });
  return out;
}
const COUNTED = new Set(["SUPPLEMENT", "HEAVY_SUPPLEMENT"]);

describe("scope separation", () => {
  it("splits XOONX, PERSONAL and VEEEY into their own shipments", () => {
    const input = items([
      { scope: "XOONX", type: "XOONX", productId: 1, n: 3 },
      { scope: "PERSONAL", type: "DEVICE", productId: 2, n: 2 },
      { scope: "VEEEY", type: "SUPPLEMENT", productId: 3, n: 4 },
    ]);
    const groups = splitTripIntoShipments(input);
    expect(groups.filter((g) => g.scope === "XOONX")).toHaveLength(1);
    expect(groups.filter((g) => g.scope === "PERSONAL")).toHaveLength(1);
    expect(groups.filter((g) => g.scope === "VEEEY")).toHaveLength(1);
  });
});

describe("VEEEY below threshold", () => {
  it("keeps everything (incl. devices) in one shipment when counted < 20", () => {
    const input = items([
      { scope: "VEEEY", type: "SUPPLEMENT", productId: 1, n: 10 },
      { scope: "VEEEY", type: "DEVICE", productId: 2, n: 4 },
    ]);
    const groups = splitTripIntoShipments(input);
    expect(groups).toHaveLength(1);
    expect(groups[0].itemIds).toHaveLength(14);
  });
});

describe("VEEEY split invariants (≥20 counted)", () => {
  const check = (input: SplitItem[]) => {
    const groups = splitTripIntoShipments(input).filter((g) => g.scope === "VEEEY");
    const typeOf = new Map(input.map((i) => [i.id, i.type]));
    const prodOf = new Map(input.map((i) => [i.id, i.productId]));
    for (const g of groups) {
      const counted = g.itemIds.filter((id) => COUNTED.has(typeOf.get(id)!));
      expect(counted.length).toBeLessThanOrEqual(MAX_PER_SHIPMENT);
      const perProduct = new Map<number, number>();
      for (const id of g.itemIds) perProduct.set(prodOf.get(id)!, (perProduct.get(prodOf.get(id)!) ?? 0) + 1);
      for (const c of perProduct.values()) expect(c).toBeLessThanOrEqual(MAX_SAME_PRODUCT);
    }
    // every item placed exactly once
    const all = groups.flatMap((g) => g.itemIds);
    expect(new Set(all).size).toBe(all.length);
    return groups;
  };

  it("many products, few each → even split, all caps held", () => {
    const spec = Array.from({ length: 12 }, (_, p) => ({ scope: "VEEEY", type: "SUPPLEMENT", productId: p + 1, n: 2 }));
    const groups = check(items(spec)); // 24 counted
    expect(groups.length).toBeGreaterThanOrEqual(2);
  });

  it("all the same product (25) → forces ≥5 shipments to honor ≤5/product", () => {
    const groups = check(items([{ scope: "VEEEY", type: "SUPPLEMENT", productId: 1, n: 25 }]));
    expect(groups.length).toBeGreaterThanOrEqual(5);
  });

  it("devices ride along uncounted: 19 supplements + 8 devices stays one shipment", () => {
    // 19 counted < 20 → single shipment despite 27 physical items
    const groups = splitTripIntoShipments(
      items([
        { scope: "VEEEY", type: "SUPPLEMENT", productId: 1, n: 19 },
        { scope: "VEEEY", type: "DEVICE", productId: 2, n: 8 },
      ]),
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].itemIds).toHaveLength(27);
  });

  it("20 counted + devices → splits, devices distributed across shipments", () => {
    const input = items([
      { scope: "VEEEY", type: "SUPPLEMENT", productId: 1, n: 5 },
      { scope: "VEEEY", type: "SUPPLEMENT", productId: 2, n: 5 },
      { scope: "VEEEY", type: "SUPPLEMENT", productId: 3, n: 5 },
      { scope: "VEEEY", type: "SUPPLEMENT", productId: 4, n: 5 },
      { scope: "VEEEY", type: "DEVICE", productId: 9, n: 3 },
    ]);
    const groups = check(input); // 20 counted, 3 devices
    const total = groups.flatMap((g) => g.itemIds).length;
    expect(total).toBe(23); // all 23 physical items placed
  });
});
