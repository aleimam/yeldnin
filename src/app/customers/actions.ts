"use server";
import { revalidatePath } from "next/cache";
import { requireUser, type Access } from "@/lib/auth/access";
import { validateCustomer, customerScopes, moduleForCustomerScope } from "@/lib/customers/customers-logic";
import { createCustomer, updateCustomer, archiveCustomer, getCustomer } from "@/lib/customers/customers-service";
import { writeAudit } from "@/lib/audit";

export interface CustomerPayload {
  name: string;
  scope: string;
  contactChannel: string;
  contactNumber?: string;
  notes?: string;
}
export type SaveResult = { ok: true; id: number } | { ok: false; error: string };

const canManage = (access: Access, scope: string) => customerScopes(access, "OPERATE").includes(scope as never);

export async function createCustomerAction(p: CustomerPayload): Promise<SaveResult> {
  const access = await requireUser();
  if (!canManage(access, p.scope)) return { ok: false, error: "You can't add customers in that scope." };
  const errs = validateCustomer(p);
  if (Object.keys(errs).length) return { ok: false, error: Object.values(errs)[0] };
  const c = await createCustomer(p, access.user.id);
  await writeAudit(access.user.id, moduleForCustomerScope(p.scope), "customer.create", "customer", c.id, { name: p.name });
  revalidatePath("/customers");
  return { ok: true, id: c.id };
}
export async function saveCustomerAction(p: CustomerPayload & { id: number; active: boolean }): Promise<SaveResult> {
  const access = await requireUser();
  const existing = await getCustomer(p.id);
  if (!existing) return { ok: false, error: "Not found." };
  if (!canManage(access, existing.scope) || !canManage(access, p.scope)) {
    return { ok: false, error: "You can't manage customers in that scope." };
  }
  const errs = validateCustomer(p);
  if (Object.keys(errs).length) return { ok: false, error: Object.values(errs)[0] };
  await updateCustomer(p.id, { ...p, active: p.active }, access.user.id);
  await writeAudit(access.user.id, moduleForCustomerScope(p.scope), "customer.update", "customer", p.id);
  revalidatePath("/customers");
  revalidatePath(`/customers/${p.id}`);
  return { ok: true, id: p.id };
}
export async function archiveCustomerAction(id: number): Promise<void> {
  const access = await requireUser();
  const existing = await getCustomer(id);
  if (!existing || !canManage(access, existing.scope)) return;
  await archiveCustomer(id);
  await writeAudit(access.user.id, moduleForCustomerScope(existing.scope), "customer.archive", "customer", id);
  revalidatePath("/customers");
}
