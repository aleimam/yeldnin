import "server-only";
import { prisma } from "@/lib/db";
import type { CountryKey } from "@/lib/pricing/pricing-logic";

export function listSuppliers() {
  return prisma.supplier.findMany({
    where: { archivedAt: null },
    orderBy: { name: "asc" },
  });
}

/** Suppliers available for a given import country (for the calculator dropdown). */
export function listSuppliersForCountry(country: CountryKey) {
  const flag =
    country === "USA"
      ? { availableUSA: true }
      : country === "UK"
        ? { availableUK: true }
        : { availableEU: true };
  return prisma.supplier.findMany({
    where: { archivedAt: null, active: true, ...flag },
    orderBy: { name: "asc" },
  });
}

export function createSupplier(input: {
  name: string;
  availableUSA: boolean;
  availableUK: boolean;
  availableEU: boolean;
  contact?: string;
}) {
  return prisma.supplier.create({ data: { ...input, name: input.name.trim() } });
}

export function updateSupplier(
  id: number,
  input: {
    name: string;
    availableUSA: boolean;
    availableUK: boolean;
    availableEU: boolean;
    contact?: string;
    active: boolean;
  },
) {
  return prisma.supplier.update({
    where: { id },
    data: { ...input, name: input.name.trim() },
  });
}

export function archiveSupplier(id: number) {
  return prisma.supplier.update({
    where: { id },
    data: { archivedAt: new Date() },
  });
}
