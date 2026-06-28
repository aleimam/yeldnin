import "server-only";
import { prisma } from "@/lib/db";
import { clean } from "@/lib/text";
import { nextUid } from "@/lib/uid";

export interface CarrierInput {
  name: string;
  contact?: string | null;
}

export function listCarriers() {
  return prisma.carrier.findMany({ where: { archivedAt: null }, orderBy: { createdAt: "desc" }, take: 200 });
}
/** Paginated + searchable carriers (name / uid / contact). */
export async function listCarriersPaged(opts: { search?: string; skip?: number; take?: number }) {
  const where = { archivedAt: null, ...(opts.search ? { OR: [{ name: { contains: opts.search } }, { uid: { contains: opts.search } }, { contact: { contains: opts.search } }] } : {}) };
  const [rows, total] = await prisma.$transaction([
    prisma.carrier.findMany({ where, orderBy: { createdAt: "desc" }, skip: opts.skip ?? 0, take: opts.take ?? 50 }),
    prisma.carrier.count({ where }),
  ]);
  return { rows, total };
}
export function getCarrier(id: number) {
  return prisma.carrier.findFirst({ where: { id, archivedAt: null } });
}
/** Active carriers for a picker (e.g. the Dispatch/Transfer forms). */
export function listCarriersForPicker() {
  return prisma.carrier.findMany({
    where: { archivedAt: null, active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}
export async function createCarrier(input: CarrierInput, userId: number) {
  const uid = await nextUid("CAR");
  return prisma.carrier.create({ data: { uid, name: input.name.trim(), contact: clean(input.contact), createdById: userId } });
}
export async function updateCarrier(id: number, input: CarrierInput & { active: boolean }, userId: number) {
  return prisma.carrier.update({
    where: { id },
    data: { name: input.name.trim(), contact: clean(input.contact), active: input.active, updatedById: userId },
  });
}
export async function archiveCarrier(id: number) {
  return prisma.carrier.update({ where: { id }, data: { archivedAt: new Date(), active: false } });
}
