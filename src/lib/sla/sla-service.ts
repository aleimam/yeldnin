import "server-only";
import { prisma } from "@/lib/db";
import { getSla } from "./sla-config-service";
import { computeItemSla, type SlaSettings, type SlaStatus } from "./sla-logic";

interface ItemRow {
  id: number;
  requestId: number | null;
  scope: string;
  createdAt: Date;
  promisedDeliveryAt: Date | null;
  isSpecialOrder: boolean;
  containerType: string | null;
  containerId: number | null;
  product: { type: string; defaultSupplier: { slaClass: string | null } | null };
}

export interface ItemSla {
  itemId: number;
  promised: Date;
  expected: Date;
  status: SlaStatus;
}

/** Field selection for SLA computation — use for list queries. */
export const SLA_ITEM_SELECT = {
  id: true,
  requestId: true,
  scope: true,
  createdAt: true,
  promisedDeliveryAt: true,
  isSpecialOrder: true,
  containerType: true,
  containerId: true,
  product: { select: { type: true, defaultSupplier: { select: { slaClass: true } } } },
} as const;

/** Delivery dates of the trips currently carrying these items (containerType TRIP). */
async function tripDates(items: ItemRow[]): Promise<Map<number, Date | null>> {
  const ids = [...new Set(items.filter((i) => i.containerType === "TRIP" && i.containerId).map((i) => i.containerId!))];
  if (!ids.length) return new Map();
  const trips = await prisma.trip.findMany({ where: { id: { in: ids } }, select: { id: true, deliveryDateInEgypt: true } });
  return new Map(trips.map((t) => [t.id, t.deliveryDateInEgypt]));
}

function compute(it: ItemRow, td: Map<number, Date | null>, deliveredAt: Date | null, now: Date, sla: SlaSettings): ItemSla {
  const tripDeliveryAt = it.containerType === "TRIP" && it.containerId ? (td.get(it.containerId) ?? null) : null;
  const r = computeItemSla({
    scope: it.scope,
    productType: it.product.type,
    supplierSlaClass: it.product.defaultSupplier?.slaClass ?? null,
    createdAt: it.createdAt,
    promisedAt: it.promisedDeliveryAt,
    tripDeliveryAt,
    deliveredAt,
    now,
    sla,
  });
  return { itemId: it.id, promised: r.promised, expected: r.expected, status: r.status };
}

/** SLA per special-order item of ONE request (all share the request's deliveredAt). */
export async function slaForRequestItems(
  items: ItemRow[],
  deliveredAt: Date | null,
  now: Date = new Date(),
): Promise<Map<number, ItemSla>> {
  const special = items.filter((i) => i.isSpecialOrder);
  if (!special.length) return new Map();
  const [sla, td] = await Promise.all([getSla(), tripDates(special)]);
  return new Map(special.map((it) => [it.id, compute(it, td, deliveredAt, now, sla)]));
}

const RANK: Record<SlaStatus, number> = { DELIVERED: 0, HEALTHY: 1, RISK: 2, DELAYED: 3 };

/** Worst-case SLA status per request (for list badges). Only special-order items count. */
export async function worstSlaByRequest(
  requestIds: number[],
  deliveredAtByReq: Map<number, Date | null>,
  now: Date = new Date(),
): Promise<Map<number, SlaStatus>> {
  if (!requestIds.length) return new Map();
  const items = (await prisma.item.findMany({
    where: { requestId: { in: requestIds }, isSpecialOrder: true },
    select: SLA_ITEM_SELECT,
  })) as ItemRow[];
  if (!items.length) return new Map();
  const [sla, td] = await Promise.all([getSla(), tripDates(items)]);
  const out = new Map<number, SlaStatus>();
  for (const it of items) {
    if (it.requestId == null) continue;
    const s = compute(it, td, deliveredAtByReq.get(it.requestId) ?? null, now, sla).status;
    const cur = out.get(it.requestId);
    if (!cur || RANK[s] > RANK[cur]) out.set(it.requestId, s);
  }
  return out;
}
