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

export interface SupplierRow {
  id: number;
  remove: boolean;
  name: string;
  contact: string | null;
  availableUSA: boolean;
  availableUK: boolean;
  availableEU: boolean;
  active: boolean;
  slaClass: string | null;
}
export interface NewSupplier {
  name: string;
  contact: string | null;
  availableUSA: boolean;
  availableUK: boolean;
  availableEU: boolean;
  slaClass: string | null;
}

/** Apply a "Save All" batch: update/archive existing rows + optionally add one. */
export async function saveSupplierBatch(rows: SupplierRow[], add: NewSupplier | null) {
  const ops = [];
  for (const r of rows) {
    if (r.remove) {
      ops.push(prisma.supplier.update({ where: { id: r.id }, data: { archivedAt: new Date() } }));
    } else if (r.name) {
      ops.push(
        prisma.supplier.update({
          where: { id: r.id },
          data: {
            name: r.name,
            contact: r.contact,
            availableUSA: r.availableUSA,
            availableUK: r.availableUK,
            availableEU: r.availableEU,
            active: r.active,
            slaClass: r.slaClass,
          },
        }),
      );
    }
  }
  if (add?.name) ops.push(prisma.supplier.create({ data: add }));
  if (ops.length) await prisma.$transaction(ops);
}
