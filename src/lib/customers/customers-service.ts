import "server-only";
import { prisma } from "@/lib/db";
import { nextUid } from "@/lib/uid";
import { isContactChannel } from "./customers-logic";

export interface CustomerInput {
  name: string;
  scope: string;
  contactChannel: string;
  contactNumber?: string | null;
  notes?: string | null;
}
const clean = (s?: string | null) => s?.trim() || null;
const channel = (c: string) => (isContactChannel(c) ? c : "WHATSAPP");
const scopeOf = (s: string) => (s === "XOONX" ? "XOONX" : "EGV");

export function listCustomers(opts: { search?: string; scopes?: string[] } = {}) {
  return prisma.customer.findMany({
    where: {
      archivedAt: null,
      ...(opts.scopes ? { scope: { in: opts.scopes } } : {}),
      ...(opts.search ? { name: { contains: opts.search } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
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
