import "server-only";
import { prisma } from "@/lib/db";
import { nextUid } from "@/lib/uid";
import { moveItems, itemsInContainerHistory } from "@/lib/items/items-service";
import { clampLinesToPool, type PurchaseLineInput } from "./purchasing-logic";

export interface PoolRow {
  scope: string;
  productId: number;
  productName: string;
  count: number; // total pending (sum of byType)
  byType: Record<string, number>; // pending split by origin request type
}

/** Items still awaiting purchase (REQUESTED, in a REQUEST container), grouped by
 *  (scope, product) and split by the originating request's type. */
export async function pendingPool(scopes: string[]): Promise<PoolRow[]> {
  if (!scopes.length) return [];
  const items = await prisma.item.findMany({
    where: { status: "REQUESTED", containerType: "REQUEST", exceptionFlag: null, scope: { in: scopes } },
    select: { scope: true, productId: true, requestId: true, containerId: true },
  });
  if (!items.length) return [];

  // origin request → type (requestId is the anchor; containerId == request id here)
  const reqIds = [...new Set(items.map((i) => i.requestId ?? i.containerId).filter((x): x is number => x != null))];
  const requests = reqIds.length
    ? await prisma.request.findMany({ where: { id: { in: reqIds } }, select: { id: true, type: true } })
    : [];
  const typeOf = new Map(requests.map((r) => [r.id, r.type]));

  const rows = new Map<string, PoolRow>();
  for (const it of items) {
    const key = `${it.scope}:${it.productId}`;
    let row = rows.get(key);
    if (!row) {
      row = { scope: it.scope, productId: it.productId, productName: "—", count: 0, byType: {} };
      rows.set(key, row);
    }
    row.count += 1;
    const rid = it.requestId ?? it.containerId;
    const type = (rid != null ? typeOf.get(rid) : undefined) ?? "UNKNOWN";
    row.byType[type] = (row.byType[type] ?? 0) + 1;
  }

  const productIds = [...new Set(items.map((i) => i.productId))];
  const products = await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } });
  const nameOf = new Map(products.map((p) => [p.id, p.name]));
  for (const row of rows.values()) row.productName = nameOf.get(row.productId) ?? "—";

  return [...rows.values()].sort((a, b) => a.productName.localeCompare(b.productName));
}

/** Available REQUESTED units for one scope, by productId (for clamping). */
async function availableInScope(scope: string): Promise<Map<number, number>> {
  const items = await prisma.item.findMany({
    where: { status: "REQUESTED", containerType: "REQUEST", exceptionFlag: null, scope },
    select: { productId: true },
  });
  const m = new Map<number, number>();
  for (const it of items) m.set(it.productId, (m.get(it.productId) ?? 0) + 1);
  return m;
}

export interface CreatePurchaseInput {
  scope: string;
  country: string;
  supplierId?: number | null;
  purchasePrice?: number | null;
  destinationType: string;
  destinationId?: number | null;
  notes?: string | null;
  lines: PurchaseLineInput[];
}

/** Create a purchase and move the chosen pool items REQUESTED → ORDERED. */
export async function createPurchase(input: CreatePurchaseInput, userId: number) {
  const available = await availableInScope(input.scope);
  const lines = clampLinesToPool(input.lines, available);
  if (!lines.length) throw new Error("Nothing available to purchase.");

  const supplier = input.supplierId
    ? await prisma.supplier.findUnique({ where: { id: input.supplierId }, select: { name: true } })
    : null;
  let destinationName: string | null = null;
  if (input.destinationId && input.destinationType === "HUB") {
    const hub = await prisma.hub.findUnique({ where: { id: input.destinationId }, select: { name: true } });
    destinationName = hub?.name ?? null;
  } else if (input.destinationId && input.destinationType === "TRIP") {
    const trip = await prisma.trip.findUnique({
      where: { id: input.destinationId },
      select: { traveler: { select: { name: true } }, country: true },
    });
    destinationName = trip ? `${trip.traveler.name} · ${trip.country}` : null;
  }

  const uid = await nextUid("PUR");
  const purchase = await prisma.purchase.create({
    data: {
      uid,
      scope: input.scope,
      country: input.country,
      supplierId: input.supplierId ?? null,
      supplierName: supplier?.name ?? null,
      purchasePrice: input.purchasePrice ?? null,
      destinationType: input.destinationType,
      destinationId: input.destinationId ?? null,
      destinationName,
      notes: input.notes?.trim() || null,
      createdById: userId,
    },
  });

  for (const l of lines) {
    const items = await prisma.item.findMany({
      where: { status: "REQUESTED", containerType: "REQUEST", exceptionFlag: null, scope: input.scope, productId: l.productId },
      take: l.count,
      select: { id: true },
    });
    await moveItems(
      items.map((i) => i.id),
      { status: "ORDERED", containerType: "PURCHASE", containerId: purchase.id, action: "purchase" },
      userId,
    );
  }
  return purchase;
}

export function listPurchases(opts: { scopes: string[] }) {
  return prisma.purchase.findMany({
    where: { archivedAt: null, scope: { in: opts.scopes } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}
export function getPurchase(id: number) {
  return prisma.purchase.findFirst({ where: { id, archivedAt: null } });
}
export function getPurchaseItems(purchaseId: number) {
  return itemsInContainerHistory("PURCHASE", purchaseId);
}
export function listHubsForPicker() {
  return prisma.hub.findMany({
    where: { archivedAt: null, active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, country: true },
  });
}
