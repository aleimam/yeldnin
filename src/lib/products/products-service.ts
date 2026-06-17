import "server-only";
import { prisma } from "@/lib/db";
import { nextUid } from "@/lib/uid";
import type { Scope, ProductType } from "./products-logic";
import type { ProductImportRow } from "./products-import-logic";
import { itemBucket, ITEM_BUCKETS, type ItemBucket } from "@/lib/items/items-logic";

export interface ProductInput {
  name: string;
  sku?: string | null;
  scope: Scope;
  type: ProductType;
  originRegion?: string | null;
  defaultSupplierId?: number | null;
  weightG?: number | null;
  purchasePrice?: number | null;
  sellingPrice?: number | null;
  size?: string | null;
  grade?: string | null;
  url?: string | null;
  notes?: string | null;
  isMaleSupport: boolean;
}

const clean = (s?: string | null) => s?.trim() || null;

export function listProducts(opts: { scopes: Scope[]; search?: string }) {
  return prisma.product.findMany({
    where: {
      archivedAt: null,
      scope: { in: opts.scopes },
      ...(opts.search ? { name: { contains: opts.search } } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { defaultSupplier: { select: { name: true } }, _count: { select: { photos: true } } },
    take: 200,
  });
}

export function getProduct(id: number) {
  return prisma.product.findFirst({
    where: { id, archivedAt: null },
    include: { photos: true, defaultSupplier: { select: { id: true, name: true } } },
  });
}

export interface ProductContainerRef {
  type: string; // REQUEST | PURCHASE | PATCH | TRIP | HUB | SHIPMENT | ORDER
  id: number;
  label: string;
  href: string | null;
  items: number; // distinct units of this product that touched the container
}

const CONTAINER_HREF: Record<string, (id: number) => string> = {
  REQUEST: (id) => `/requests/${id}`,
  PURCHASE: (id) => `/purchasing/purchases/${id}`,
  PATCH: (id) => `/patches/${id}`,
  TRIP: (id) => `/trips/${id}`,
  HUB: (id) => `/hubs/${id}`,
  SHIPMENT: (id) => `/shipments/${id}`,
};
const CONTAINER_ORDER = ["REQUEST", "PURCHASE", "PATCH", "TRIP", "HUB", "SHIPMENT", "ORDER"];

/**
 * 360° view of a product: its details, item-status statistics, the requests that
 * ordered it, and every container its units have passed through (from item
 * history) — purchases, patches, trips, hubs, shipments — each linkable.
 */
export async function productDetail(id: number) {
  const product = await getProduct(id);
  if (!product) return null;

  const items = await prisma.item.findMany({
    where: { productId: id },
    select: { status: true, exceptionFlag: true },
  });
  const buckets = Object.fromEntries(ITEM_BUCKETS.map((b) => [b, 0])) as Record<ItemBucket, number>;
  for (const it of items) buckets[itemBucket(it.status, it.exceptionFlag ?? undefined)] += 1;

  const lines = await prisma.requestLine.findMany({
    where: { productId: id, request: { archivedAt: null } },
    select: {
      count: true,
      sellingPrice: true,
      request: { select: { id: true, uid: true, type: true, scope: true, createdAt: true, customer: { select: { name: true } } } },
    },
    orderBy: { id: "desc" },
  });
  const requests = lines.map((l) => ({
    id: l.request.id,
    uid: l.request.uid,
    type: l.request.type,
    scope: l.request.scope,
    customer: l.request.customer?.name ?? null,
    count: l.count,
    sellingPrice: l.sellingPrice,
    createdAt: l.request.createdAt,
  }));

  // Containers the product's units have ever been in (from item event history).
  const events = await prisma.itemEvent.findMany({
    where: { item: { productId: id }, containerId: { not: null } },
    select: { itemId: true, containerType: true, containerId: true },
  });
  const grouped = new Map<string, { type: string; id: number; items: Set<number> }>();
  for (const e of events) {
    if (!e.containerType || e.containerId == null) continue;
    const key = `${e.containerType}:${e.containerId}`;
    let g = grouped.get(key);
    if (!g) { g = { type: e.containerType, id: e.containerId, items: new Set() }; grouped.set(key, g); }
    g.items.add(e.itemId);
  }
  const idsByType = new Map<string, number[]>();
  for (const g of grouped.values()) idsByType.set(g.type, [...(idsByType.get(g.type) ?? []), g.id]);
  const labelOf = new Map<string, string>();
  const resolve = async (type: string, run: (ids: number[]) => Promise<{ id: number; label: string }[]>) => {
    const ids = idsByType.get(type);
    if (!ids?.length) return;
    for (const r of await run([...new Set(ids)])) labelOf.set(`${type}:${r.id}`, r.label);
  };
  await Promise.all([
    resolve("REQUEST", async (ids) => (await prisma.request.findMany({ where: { id: { in: ids } }, select: { id: true, uid: true } })).map((r) => ({ id: r.id, label: r.uid ?? `#${r.id}` }))),
    resolve("PURCHASE", async (ids) => (await prisma.purchase.findMany({ where: { id: { in: ids } }, select: { id: true, uid: true } })).map((r) => ({ id: r.id, label: r.uid ?? `#${r.id}` }))),
    resolve("PATCH", async (ids) => (await prisma.patch.findMany({ where: { id: { in: ids } }, select: { id: true, uid: true } })).map((r) => ({ id: r.id, label: r.uid ?? `#${r.id}` }))),
    resolve("TRIP", async (ids) => (await prisma.trip.findMany({ where: { id: { in: ids } }, select: { id: true, uid: true, country: true } })).map((r) => ({ id: r.id, label: `${r.uid ?? `#${r.id}`} · ${r.country}` }))),
    resolve("HUB", async (ids) => (await prisma.hub.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })).map((r) => ({ id: r.id, label: r.name }))),
    resolve("SHIPMENT", async (ids) => (await prisma.shipment.findMany({ where: { id: { in: ids } }, select: { id: true, uid: true } })).map((r) => ({ id: r.id, label: r.uid ?? `#${r.id}` }))),
  ]);
  const containers: ProductContainerRef[] = [...grouped.values()]
    .map((g) => ({ type: g.type, id: g.id, label: labelOf.get(`${g.type}:${g.id}`) ?? `#${g.id}`, href: CONTAINER_HREF[g.type]?.(g.id) ?? null, items: g.items.size }))
    .sort((a, b) => (CONTAINER_ORDER.indexOf(a.type) - CONTAINER_ORDER.indexOf(b.type)) || a.id - b.id);

  return { product, totalItems: items.length, buckets, requests, containers };
}

export function listSuppliersForPicker() {
  return prisma.supplier.findMany({
    where: { archivedAt: null, active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, availableUSA: true, availableUK: true, availableEU: true },
  });
}

function dataFrom(input: ProductInput) {
  return {
    name: input.name.trim(),
    sku: clean(input.sku),
    scope: input.scope,
    type: input.type,
    originRegion: clean(input.originRegion),
    defaultSupplierId: input.defaultSupplierId ?? null,
    weightG: input.weightG ?? null,
    purchasePrice: input.purchasePrice ?? null,
    sellingPrice: input.sellingPrice ?? null,
    size: clean(input.size),
    grade: clean(input.grade),
    url: clean(input.url),
    notes: clean(input.notes),
    isMaleSupport: input.isMaleSupport,
  };
}

export async function createProduct(input: ProductInput, photoAssetIds: string[], userId: number) {
  const uid = await nextUid("PRD");
  return prisma.product.create({
    data: {
      uid,
      ...dataFrom(input),
      createdById: userId,
      photos: photoAssetIds.length ? { create: photoAssetIds.map((assetId) => ({ assetId })) } : undefined,
    },
  });
}

export async function updateProduct(
  id: number,
  input: ProductInput & { active: boolean },
  addPhotoAssetIds: string[],
  userId: number,
) {
  return prisma.product.update({
    where: { id },
    data: {
      ...dataFrom(input),
      active: input.active,
      updatedById: userId,
      ...(addPhotoAssetIds.length ? { photos: { create: addPhotoAssetIds.map((assetId) => ({ assetId })) } } : {}),
    },
  });
}

export async function archiveProduct(id: number) {
  return prisma.product.update({ where: { id }, data: { archivedAt: new Date(), active: false } });
}

/** Bulk-create products from parsed import rows (all in one scope). Returns the count. */
export async function importProducts(rows: ProductImportRow[], scope: Scope, userId: number): Promise<number> {
  let created = 0;
  for (const r of rows) {
    await createProduct({ ...r, scope, defaultSupplierId: null, isMaleSupport: false }, [], userId);
    created++;
  }
  return created;
}
