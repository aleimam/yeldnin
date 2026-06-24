import "server-only";
import { prisma } from "@/lib/db";
import { clean } from "@/lib/text";
import { nextUid } from "@/lib/uid";
import { isContactChannel } from "./customers-logic";

export interface CustomerInput {
  name: string;
  scope: string;
  contactChannel: string;
  contactNumber?: string | null;
  notes?: string | null;
}
const channel = (c: string) => (isContactChannel(c) ? c : "WHATSAPP");
const scopeOf = (s: string) => (s === "XOONX" ? "XOONX" : "EGV");

export async function listCustomers(opts: { search?: string; scopes?: string[]; sort?: string; skip?: number; take?: number } = {}) {
  const where = {
    archivedAt: null,
    ...(opts.scopes ? { scope: { in: opts.scopes } } : {}),
    ...(opts.search ? { OR: [{ name: { contains: opts.search } }, { contactNumber: { contains: opts.search } }] } : {}),
  };
  const orderBy = opts.sort === "name" ? ({ name: "asc" } as const) : ({ createdAt: "desc" } as const);
  const [rows, total] = await prisma.$transaction([
    prisma.customer.findMany({ where, orderBy, skip: opts.skip ?? 0, take: opts.take ?? 50 }),
    prisma.customer.count({ where }),
  ]);
  return { rows, total };
}
export function getCustomer(id: number) {
  return prisma.customer.findFirst({ where: { id, archivedAt: null } });
}
export async function createCustomer(input: CustomerInput, userId: number) {
  const uid = await nextUid("CUS");
  return prisma.customer.create({
    data: {
      uid,
      name: input.name.trim(),
      scope: scopeOf(input.scope),
      contactChannel: channel(input.contactChannel),
      contactNumber: clean(input.contactNumber),
      notes: clean(input.notes),
      createdById: userId,
    },
  });
}
export async function updateCustomer(id: number, input: CustomerInput & { active: boolean }, userId: number) {
  return prisma.customer.update({
    where: { id },
    data: {
      name: input.name.trim(),
      scope: scopeOf(input.scope),
      contactChannel: channel(input.contactChannel),
      contactNumber: clean(input.contactNumber),
      notes: clean(input.notes),
      active: input.active,
      updatedById: userId,
    },
  });
}
export async function archiveCustomer(id: number) {
  return prisma.customer.update({ where: { id }, data: { archivedAt: new Date(), active: false } });
}
