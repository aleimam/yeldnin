"use server";
import { getAccess } from "@/lib/auth/access";
import * as inq from "@/lib/inquiry/inquiry-service";

// Inquiries are universal (any authenticated user). Admin sees all + analytics.
async function requireMe(): Promise<{ id: number; isAdmin: boolean }> {
  const access = await getAccess();
  if (!access.user) throw new Error("Unauthorized");
  return { id: access.user.id, isAdmin: access.isAdmin };
}

export async function listUnitActorsAction(unitKind: string, unitId: number) {
  const me = await requireMe();
  return inq.listUnitActors(unitKind, unitId, me.id);
}

export async function createInquiryAction(input: {
  unitKind: string;
  unitId: number;
  recipientUserId: number;
  body?: string;
  attachments?: { assetId: string }[];
}) {
  const me = await requireMe();
  return inq.createInquiry(me.id, input);
}

export async function replyInquiryAction(
  inquiryId: number,
  input: { body?: string; attachments?: { assetId: string }[] },
) {
  const me = await requireMe();
  return inq.replyInquiry(me.id, inquiryId, input);
}

export async function closeInquiryAction(inquiryId: number, dispositionId: number) {
  const me = await requireMe();
  return inq.closeInquiry(me.id, inquiryId, dispositionId);
}

export async function loadInquiryAction(inquiryId: number) {
  const me = await requireMe();
  return inq.getInquiry(me.id, inquiryId, me.isAdmin);
}

export async function loadMyInquiriesAction() {
  const me = await requireMe();
  return inq.listMyInquiries(me.id);
}

export async function loadUnitInquiriesAction(unitKind: string, unitId: number) {
  const me = await requireMe();
  return inq.listUnitInquiries(me.id, unitKind, unitId, me.isAdmin);
}

export async function loadDispositionsAction() {
  await requireMe();
  return inq.listDispositions();
}

async function requireAdmin(): Promise<void> {
  const access = await getAccess();
  if (!access.user || !access.isAdmin) throw new Error("Forbidden");
}

export async function createDispositionAction(label: string, labelAr?: string) {
  await requireAdmin();
  return inq.createDisposition({ label, labelAr });
}

export async function deleteDispositionAction(id: number) {
  await requireAdmin();
  await inq.deleteDisposition(id);
  return { ok: true as const };
}
