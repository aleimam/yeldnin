import "server-only";
import { prisma } from "@/lib/db";
import { clean } from "@/lib/text";
import { nextUid } from "@/lib/uid";

export interface CourierInput {
  name: string;
  contact?: string | null;
}

export function listCouriers() {
  return prisma.courier.findMany({ where: { archivedAt: null }, orderBy: { createdAt: "desc" }, take: 200 });
}
export function getCourier(id: number) {
  return prisma.courier.findFirst({ where: { id, archivedAt: null } });
}
/** Active couriers for a picker (e.g. the Patch form). */
export function listCouriersForPicker() {
  return prisma.courier.findMany({
    where: { archivedAt: null, active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}
export async function createCourier(input: CourierInput, userId: number) {
  const uid = await nextUid("CUR");
  return prisma.courier.create({ data: { uid, name: input.name.trim(), contact: clean(input.contact), createdById: userId } });
}
export async function updateCourier(id: number, input: CourierInput & { active: boolean }, userId: number) {
  return prisma.courier.update({
    where: { id },
    data: { name: input.name.trim(), contact: clean(input.contact), active: input.active, updatedById: userId },
  });
}
export async function archiveCourier(id: number) {
  return prisma.courier.update({ where: { id }, data: { archivedAt: new Date(), active: false } });
}
