"use server";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth/access";
import { validateTraveler } from "@/lib/travelers/travelers-logic";
import { createTraveler, updateTraveler, archiveTraveler } from "@/lib/travelers/travelers-service";
import { writeAudit } from "@/lib/audit";

export interface TravelerPayload {
  name: string;
  contact?: string;
  notes?: string;
  referenceTravelerId?: number | null;
  blacklisted: boolean;
  staticAddress: boolean;
  carriesMaleSupport: boolean;
  allowedProductTypes: string[];
  photoIds?: string[];
}
export type SaveResult = { ok: true; id: number } | { ok: false; error: string };

export async function createTravelerAction(p: TravelerPayload): Promise<SaveResult> {
  const access = await requireCapability("logistics", "operate");
  const errs = validateTraveler(p);
  if (Object.keys(errs).length) return { ok: false, error: Object.values(errs)[0] };
  const tr = await createTraveler(p, p.photoIds ?? [], access.user.id);
  await writeAudit(access.user.id, "logistics", "traveler.create", "traveler", tr.id, { name: p.name });
  revalidatePath("/travelers");
  return { ok: true, id: tr.id };
}
export async function saveTravelerAction(p: TravelerPayload & { id: number; active: boolean }): Promise<SaveResult> {
  const access = await requireCapability("logistics", "operate");
  const errs = validateTraveler(p);
  if (Object.keys(errs).length) return { ok: false, error: Object.values(errs)[0] };
  await updateTraveler(p.id, { ...p, active: p.active }, p.photoIds ?? [], access.user.id);
  await writeAudit(access.user.id, "logistics", "traveler.update", "traveler", p.id);
  revalidatePath("/travelers");
  revalidatePath(`/travelers/${p.id}`);
  return { ok: true, id: p.id };
}
export async function archiveTravelerAction(id: number): Promise<void> {
  const access = await requireCapability("logistics", "operate");
  await archiveTraveler(id);
  await writeAudit(access.user.id, "logistics", "traveler.archive", "traveler", id);
  revalidatePath("/travelers");
}
