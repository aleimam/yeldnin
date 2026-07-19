// Pure Operations logic — the Trip → Shipments split. No DB/IO. Unit-tested.
//
// Rules (from the blueprint / SUPPLY_CHAIN.md §6), applied on converting a
// picked-up trip:
//   - XOONX items   → one shipment.
//   - PERSONAL items → one shipment.
//   - VEEEY items: if the COUNTED items (Supplements + Heavy Supplements) are
//     < 20 → one shipment with all VEEEY items. If ≥ 20 → split the counted items
//     with HARD caps ≤19 per shipment and ≤5 of the same product per shipment;
//     SOFT target ≥10 and even distribution (min may break to honor the per-
//     product cap). Devices/Injection ride along, distributed but not counted.

export interface SplitItem {
  id: number;
  scope: string; // VEEEY | XOONX | PERSONAL
  productId: number;
  type: string; // SUPPLEMENT | DEVICE | INJECTION | HEAVY_SUPPLEMENT | XOONX
}
export interface ShipmentGroup {
  scope: string;
  itemIds: number[];
}

const COUNTED_TYPES = new Set(["SUPPLEMENT", "HEAVY_SUPPLEMENT"]);
export const VEEEY_SPLIT_THRESHOLD = 20;
export const MAX_PER_SHIPMENT = 19;
export const MAX_SAME_PRODUCT = 5;

export function splitTripIntoShipments(items: SplitItem[]): ShipmentGroup[] {
  const groups: ShipmentGroup[] = [];

  const xoonx = items.filter((i) => i.scope === "XOONX");
  if (xoonx.length) groups.push({ scope: "XOONX", itemIds: xoonx.map((i) => i.id) });

  const personal = items.filter((i) => i.scope === "PERSONAL");
  if (personal.length) groups.push({ scope: "PERSONAL", itemIds: personal.map((i) => i.id) });

  const egv = items.filter((i) => i.scope === "VEEEY");
  if (egv.length) {
    const counted = egv.filter((i) => COUNTED_TYPES.has(i.type));
    const uncounted = egv.filter((i) => !COUNTED_TYPES.has(i.type));

    if (counted.length < VEEEY_SPLIT_THRESHOLD) {
      groups.push({ scope: "VEEEY", itemIds: egv.map((i) => i.id) });
    } else {
      // How many shipments: enough to keep ≤19 total AND ≤5 of any one product.
      const perProduct = new Map<number, number>();
      for (const it of counted) perProduct.set(it.productId, (perProduct.get(it.productId) ?? 0) + 1);
      const byProductCap = Math.max(...[...perProduct.values()].map((c) => Math.ceil(c / MAX_SAME_PRODUCT)));
      const sc = Math.max(Math.ceil(counted.length / MAX_PER_SHIPMENT), byProductCap);

      const bins: number[][] = Array.from({ length: sc }, () => []);
      // Sort by product so each product's items sit at consecutive cursor
      // positions → round-robin spreads them ≤ceil(count/sc) ≤5 per bin.
      const sorted = [...counted].sort((a, b) => a.productId - b.productId);
      sorted.forEach((it, idx) => bins[idx % sc].push(it.id));
      // Devices/Injection ride along, distributed round-robin (uncounted).
      uncounted.forEach((it, idx) => bins[idx % sc].push(it.id));

      for (const b of bins) if (b.length) groups.push({ scope: "VEEEY", itemIds: b });
    }
  }
  return groups;
}
