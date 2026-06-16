"use server";
import { revalidatePath } from "next/cache";
import { requireModule } from "@/lib/auth/access";
import { validateCourier } from "@/lib/couriers/couriers-logic";
import { createCourier, updateCourier, archiveCourier } from "@/lib/couriers/couriers-service";
import { writeAudit } from "@/lib/audit";

export interface CourierPayload {
  name: string;
  contact?: string;
}
export type SaveResult = { ok: true; id: number } | { ok: false; error: string };

export async function createCourierAction(p: CourierPayload): Promise<SaveResult> {
  const access = await requireModule("couriers", "OPERATE");
  const errs = validateCourier(p);
  if (Object.keys(errs).length) return { ok: false, error: Object.values(errs)[0] };
  const c = await createCourier(p, access.user.id);
  await writeAudit(access.user.id, "couriers", "courier.create", "courier", c.id, { name: p.name });
  revalidatePath("/couriers");
  return { ok: true, id: c.id };
}
export async function saveCourierAction(p: CourierPayload & { id: number; active: boolean }): Promise<SaveResult> {
  const access = await requireModule("couriers", "OPERATE");
  const errs = validateCourier(p);
  if (Object.keys(errs).length) return { ok: false, error: Object.values(errs)[0] };
  await updateCourier(p.id, { ...p, active: p.active }, access.user.id);
  await writeAudit(access.user.id, "couriers", "courier.update", "courier", p.id);
  revalidatePath("/couriers");
  revalidatePath(`/couriers/${p.id}`);
  return { ok: true, id: p.id };
}
export async function archiveCourierAction(id: number): Promise<void> {
  const access = await requireModule("couriers", "OPERATE");
  await archiveCourier(id);
  await writeAudit(access.user.id, "couriers", "courier.archive", "courier", id);
  revalidatePath("/couriers");
}
