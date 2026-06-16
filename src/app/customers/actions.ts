"use server";
import { revalidatePath } from "next/cache";
import { requireModule } from "@/lib/auth/access";
import { validateCustomer } from "@/lib/customers/customers-logic";
import { createCustomer, updateCustomer, archiveCustomer } from "@/lib/customers/customers-service";
import { writeAudit } from "@/lib/audit";

export interface CustomerPayload {
  name: string;
  contactChannel: string;
  contactNumber?: string;
  notes?: string;
}
export type SaveResult = { ok: true; id: number } | { ok: false; error: string };

export async function createCustomerAction(p: CustomerPayload): Promise<SaveResult> {
  const access = await requireModule("order_requests", "OPERATE");
  const errs = validateCustomer(p);
  if (Object.keys(errs).length) return { ok: false, error: Object.values(errs)[0] };
  const c = await createCustomer(p, access.user.id);
  await writeAudit(access.user.id, "order_requests", "customer.create", "customer", c.id, { name: p.name });
  revalidatePath("/customers");
  return { ok: true, id: c.id };
}
export async function saveCustomerAction(p: CustomerPayload & { id: number; active: boolean }): Promise<SaveResult> {
  const access = await requireModule("order_requests", "OPERATE");
  const errs = validateCustomer(p);
  if (Object.keys(errs).length) return { ok: false, error: Object.values(errs)[0] };
  await updateCustomer(p.id, { ...p, active: p.active }, access.user.id);
  await writeAudit(access.user.id, "order_requests", "customer.update", "customer", p.id);
  revalidatePath("/customers");
  revalidatePath(`/customers/${p.id}`);
  return { ok: true, id: p.id };
}
export async function archiveCustomerAction(id: number): Promise<void> {
  const access = await requireModule("order_requests", "OPERATE");
  await archiveCustomer(id);
  await writeAudit(access.user.id, "order_requests", "customer.archive", "customer", id);
  revalidatePath("/customers");
}
