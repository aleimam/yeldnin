import "server-only";
import { prisma } from "@/lib/db";
import { nextUid } from "@/lib/uid";
import { moveItems, itemsInContainerHistory } from "@/lib/items/items-service";
import { clampLinesToPool, type PurchaseLineInput } from "./purchasing-logic";

/** Items still awaiting purchase (REQUESTED, in a REQUEST container), grouped. */
export async function pendingPool(scopes: string[]): Promise<
  { scope: string; productId: number; productName: string; count: number }[]
> {
  if (!scopes.length) return [];
  const items = await prisma.item.findMany({
    where: { status: "REQUESTED", containerType: "REQUEST", exceptionFlag: null, scope: { in: scopes } },
    select: { scope: true, productId: true },
  });
  const counts = new Map<string, number>();
  for (const it of items) counts.set(`${it.scope}:${it.productId}`, (counts.get(`${it.scope}:${it.productId}`) ?? 0) + 1);
  if (!counts.size) return [];
  const productIds = [...new Set(items.map((i) => i.productId))];
  const products = await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } });
  const nameOf = new Map(products.map((p) => [p.id, p.name]));
  return [...counts.entries()]
    .map(([key, count]) => {
      const [scope, pid] = key.split(":");
      return { scope, productId: Number(pid), productName: nameOf.get(Number(pid)) ?? "—", count };
    })
    .sort((a, b) => a.productName.localeCompare(b.productName));
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
  const hub =
    input.destinationType === "HUB" && input.destinationId
      ? await prisma.hub.findUnique({ where: { id: input.destinationId }, select: { name: true } })
      : null;

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
      destinationName: hub?.name ?? null,
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
