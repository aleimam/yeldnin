"use server";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth/access";
import { validateCarrier } from "@/lib/carriers/carriers-logic";
import { createCarrier, updateCarrier, archiveCarrier } from "@/lib/carriers/carriers-service";
import { writeAudit } from "@/lib/audit";

export interface CarrierPayload {
  name: string;
  contact?: string;
}
export type SaveResult = { ok: true; id: number } | { ok: false; error: string };

export async function createCarrierAction(p: CarrierPayload): Promise<SaveResult> {
  const access = await requireCapability("logistics", "operate");
  const errs = validateCarrier(p);
  if (Object.keys(errs).length) return { ok: false, error: Object.values(errs)[0] };
  const c = await createCarrier(p, access.user.id);
  await writeAudit(access.user.id, "logistics", "carrier.create", "carrier", c.id, { name: p.name });
  revalidatePath("/carriers");
  return { ok: true, id: c.id };
}
export async function saveCarrierAction(p: CarrierPayload & { id: number; active: boolean }): Promise<SaveResult> {
  const access = await requireCapability("logistics", "operate");
  const errs = validateCarrier(p);
  if (Object.keys(errs).length) return { ok: false, error: Object.values(errs)[0] };
  await updateCarrier(p.id, { ...p, active: p.active }, access.user.id);
  await writeAudit(access.user.id, "logistics", "carrier.update", "carrier", p.id);
  revalidatePath("/carriers");
  revalidatePath(`/carriers/${p.id}`);
  return { ok: true, id: p.id };
}
export async function archiveCarrierAction(id: number): Promise<void> {
  const access = await requireCapability("logistics", "operate");
  await archiveCarrier(id);
  await writeAudit(access.user.id, "logistics", "carrier.archive", "carrier", id);
  revalidatePath("/carriers");
}
