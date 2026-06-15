import "server-only";
import { prisma } from "@/lib/db";
import {
  computeSupplementPrice,
  computeDevicePrice,
  type SupplementInput,
  type DeviceInput,
} from "./pricing-logic";
import { getPricingConfig } from "./pricing-config-service";

interface CommonMeta {
  productName?: string | null;
  supplierId?: number | null;
  notes?: string | null;
  photoAssetIds?: string[];
  userId: number;
}

async function resolveSupplierName(supplierId?: number | null) {
  if (!supplierId) return null;
  const s = await prisma.supplier.findUnique({ where: { id: supplierId } });
  return s?.name ?? null;
}

export async function createSupplementCalculation(
  input: SupplementInput,
  meta: CommonMeta,
) {
  const config = await getPricingConfig();
  const result = computeSupplementPrice(input, config);
  const supplierName = await resolveSupplierName(meta.supplierId);
  return prisma.pricingCalculation.create({
    data: {
      section: "SUPPLEMENT",
      productName: meta.productName ?? null,
      importedFrom: input.importedFrom,
      supplierId: meta.supplierId ?? null,
      supplierName,
      price: result.price,
      inputJson: JSON.stringify(input),
      configJson: JSON.stringify(config),
      notes: meta.notes ?? null,
      userId: meta.userId,
      photos: meta.photoAssetIds?.length
        ? { create: meta.photoAssetIds.map((assetId) => ({ assetId })) }
        : undefined,
    },
  });
}

export async function createDeviceCalculation(
  input: DeviceInput,
  meta: CommonMeta,
) {
  const config = await getPricingConfig();
  const result = computeDevicePrice(input, config);
  const supplierName = await resolveSupplierName(meta.supplierId);
  return prisma.pricingCalculation.create({
    data: {
      section: "DEVICE",
      productName: meta.productName ?? null,
      importedFrom: input.importedFrom,
      supplierId: meta.supplierId ?? null,
      supplierName,
      price: result.price,
      inputJson: JSON.stringify(input),
      configJson: JSON.stringify(config),
      notes: meta.notes ?? null,
      userId: meta.userId,
      photos: meta.photoAssetIds?.length
        ? { create: meta.photoAssetIds.map((assetId) => ({ assetId })) }
        : undefined,
    },
  });
}

export function listHistory(opts: {
  isAdmin: boolean;
  section?: "SUPPLEMENT" | "DEVICE";
  search?: string;
  take?: number;
  skip?: number;
}) {
  return prisma.pricingCalculation.findMany({
    where: {
      // non-admins never see soft-deleted rows; admins see everything
      ...(opts.isAdmin ? {} : { deletedAt: null }),
      ...(opts.section ? { section: opts.section } : {}),
      ...(opts.search
        ? { productName: { contains: opts.search } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true } }, photos: true },
    take: opts.take ?? 100,
    skip: opts.skip ?? 0,
  });
}

export function getCalculation(id: number) {
  return prisma.pricingCalculation.findUnique({
    where: { id },
    include: { user: { select: { name: true } }, photos: true },
  });
}

/** Soft-delete (owner or manager). Hidden from non-admins, kept for admins. */
export async function softDeleteCalculation(id: number, byUserId: number) {
  await prisma.pricingCalculation.update({
    where: { id },
    data: { deletedAt: new Date(), deletedById: byUserId },
  });
}
