import "server-only";
import { prisma } from "@/lib/db";
import { nextUid } from "@/lib/uid";
import { createItems } from "@/lib/items/items-service";
import { createCustomer } from "@/lib/customers/customers-service";
import { getSla } from "@/lib/sla/sla-config-service";
import { graceDays, sourceClass, promisedDate } from "@/lib/sla/sla-logic";

export interface CreateRequestInput {
  type: string;
  scope: string;
  customerId?: number | null;
  newCustomer?: { name: string; contactNumber?: string | null } | null;
  notes?: string | null;
  lines: { productId: number; count: number; sellingPrice?: number | null; purchasePrice?: number | null; purchaseCurrency?: string | null; notes?: string | null }[];
}
const clean = (s?: string | null) => s?.trim() || null;

/** Create a request + its lines, then spawn one Item per unit at REQUESTED. */
export async function createRequest(input: CreateRequestInput, photoAssetIds: string[], userId: number) {
  let customerId = input.customerId ?? null;
  if (!customerId && input.newCustomer?.name?.trim()) {
    const c = await createCustomer(
      { name: input.newCustomer.name, scope: input.scope, contactChannel: "WHATSAPP", contactNumber: input.newCustomer.contactNumber ?? null },
      userId,
    );
    customerId = c.id;
  }
  const lines = input.lines.filter((l) => l.productId && l.count >= 1).map((l) => ({ ...l, count: Math.floor(l.count) }));
  const uid = await nextUid("REQ");
  const request = await prisma.request.create({
    data: {
      uid,
      type: input.type,
      scope: input.scope,
      customerId,
      notes: clean(input.notes),
      createdById: userId,
      lines: {
        create: lines.map((l) => ({
          productId: l.productId,
          count: l.count,
          sellingPrice: l.sellingPrice ?? null,
          purchasePrice: l.purchasePrice ?? null,
          purchaseCurrency: l.purchaseCurrency ?? null,
          notes: clean(l.notes),
        })),
      },
      photos: photoAssetIds.length ? { create: photoAssetIds.map((assetId) => ({ assetId })) } : undefined,
    },
  });
  // Special orders: snapshot each item's delivery promise (createdAt + grace).
  const isSpecial = input.type === "SPECIAL_ORDER";
  const promisedByProduct = new Map<number, Date>();
  if (isSpecial) {
    const [sla, prods] = await Promise.all([
      getSla(),
      prisma.product.findMany({
        where: { id: { in: lines.map((l) => l.productId) } },
        select: { id: true, type: true, defaultSupplier: { select: { slaClass: true } } },
      }),
    ]);
    const now = new Date();
    for (const p of prods) {
      const grace = graceDays(input.scope, sourceClass(p.type, p.defaultSupplier?.slaClass ?? null), sla);
      promisedByProduct.set(p.id, promisedDate(now, grace));
    }
  }
  for (const l of lines) {
    await createItems({
      productId: l.productId,
      scope: input.scope,
      count: l.count,
      requestId: request.id,
      isSpecialOrder: isSpecial,
      promisedDeliveryAt: isSpecial ? promisedByProduct.get(l.productId) ?? null : null,
      sellingPrice: l.sellingPrice ?? null,
      purchasePrice: l.purchasePrice ?? null,
      purchaseCurrency: l.purchaseCurrency ?? null,
      containerType: "REQUEST",
      containerId: request.id,
      status: "REQUESTED",
      userId,
    });
  }
  return request;
}

export function listRequests(opts: { scopes: string[] }) {
  return prisma.request.findMany({
    where: { archivedAt: null, scope: { in: opts.scopes } },
    orderBy: { createdAt: "desc" },
    include: { customer: { select: { name: true } }, _count: { select: { lines: true } } },
    take: 200,
  });
}

export function getRequest(id: number) {
  return prisma.request.findFirst({
    where: { id, archivedAt: null },
    include: {
      customer: { select: { id: true, name: true } },
      lines: { include: { product: { select: { id: true, name: true, uid: true } } } },
      photos: true,
    },
  });
}

/** The items spawned by a request, with product + current status. */
export function getRequestItems(requestId: number) {
  return prisma.item.findMany({
    where: { requestId },
    orderBy: { id: "asc" },
    include: { product: { select: { id: true, name: true, type: true, defaultSupplier: { select: { slaClass: true } } } } },
  });
}

export function listCustomerOptions(scopes: string[]) {
  return prisma.customer.findMany({
    where: { archivedAt: null, active: true, scope: { in: scopes } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, scope: true },
  });
}

export async function listScopedProducts(scopes: string[]) {
  const rows = await prisma.product.findMany({
    where: { archivedAt: null, active: true, scope: { in: scopes } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, scope: true },
  });
  return rows;
}
