import "server-only";
import { prisma } from "@/lib/db";
import { nextUid } from "@/lib/uid";
import type { Scope, ProductType } from "./products-logic";

export interface ProductInput {
  name: string;
  sku?: string | null;
  scope: Scope;
  type: ProductType;
  defaultSupplierId?: number | null;
  weightG?: number | null;
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
    defaultSupplierId: input.defaultSupplierId ?? null,
    weightG: input.weightG ?? null,
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
