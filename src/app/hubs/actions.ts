"use server";
import { revalidatePath } from "next/cache";
import { requireModule } from "@/lib/auth/access";
import { validateHub } from "@/lib/hubs/hubs-logic";
import { createHub, updateHub, archiveHub } from "@/lib/hubs/hubs-service";
import { writeAudit } from "@/lib/audit";

export interface HubPayload {
  name: string;
  country: string;
  notes?: string;
  photoIds?: string[];
}
export type SaveResult = { ok: true; id: number } | { ok: false; error: string };

export async function createHubAction(p: HubPayload): Promise<SaveResult> {
  const access = await requireModule("logistics", "OPERATE");
  const errs = validateHub(p);
  if (Object.keys(errs).length) return { ok: false, error: Object.values(errs)[0] };
  const h = await createHub(p, p.photoIds ?? [], access.user.id);
  await writeAudit(access.user.id, "logistics", "hub.create", "hub", h.id, { name: p.name, country: p.country });
  revalidatePath("/hubs");
  return { ok: true, id: h.id };
}
export async function saveHubAction(p: HubPayload & { id: number; active: boolean }): Promise<SaveResult> {
  const access = await requireModule("logistics", "OPERATE");
  const errs = validateHub(p);
  if (Object.keys(errs).length) return { ok: false, error: Object.values(errs)[0] };
  await updateHub(p.id, { ...p, active: p.active }, p.photoIds ?? [], access.user.id);
  await writeAudit(access.user.id, "logistics", "hub.update", "hub", p.id);
  revalidatePath("/hubs");
  revalidatePath(`/hubs/${p.id}`);
  return { ok: true, id: p.id };
}
export async function archiveHubAction(id: number): Promise<void> {
  const access = await requireModule("logistics", "OPERATE");
  await archiveHub(id);
  await writeAudit(access.user.id, "logistics", "hub.archive", "hub", id);
  revalidatePath("/hubs");
}
