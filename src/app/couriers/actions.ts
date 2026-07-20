"use server";
import { revalidatePath } from "next/cache";
import { requireCapability, requireUser } from "@/lib/auth/access";
import { validateCourier } from "@/lib/couriers/couriers-logic";
import { validatePin } from "@/lib/couriers/courier-login-logic";
import {
  createCourier,
  updateCourier,
  archiveCourier,
  createCourierLogin,
  resetCourierPin,
  setCourierLoginActive,
} from "@/lib/couriers/couriers-service";
import { writeAudit } from "@/lib/audit";

export interface CourierPayload {
  name: string;
  contact?: string;
}
export type SaveResult = { ok: true; id: number } | { ok: false; error: string };
export type LoginActionResult = { ok: true } | { ok: false; error: string };

export async function createCourierAction(p: CourierPayload): Promise<SaveResult> {
  const access = await requireCapability("couriers", "operate");
  const errs = validateCourier(p);
  if (Object.keys(errs).length) return { ok: false, error: Object.values(errs)[0] };
  const c = await createCourier(p, access.user.id);
  await writeAudit(access.user.id, "couriers", "courier.create", "courier", c.id, { name: p.name });
  revalidatePath("/couriers");
  return { ok: true, id: c.id };
}
export async function saveCourierAction(p: CourierPayload & { id: number; active: boolean }): Promise<SaveResult> {
  const access = await requireCapability("couriers", "operate");
  const errs = validateCourier(p);
  if (Object.keys(errs).length) return { ok: false, error: Object.values(errs)[0] };
  await updateCourier(p.id, { ...p, active: p.active }, access.user.id);
  await writeAudit(access.user.id, "couriers", "courier.update", "courier", p.id);
  revalidatePath("/couriers");
  revalidatePath(`/couriers/${p.id}`);
  return { ok: true, id: p.id };
}
export async function archiveCourierAction(id: number): Promise<void> {
  const access = await requireCapability("couriers", "operate");
  await archiveCourier(id);
  await writeAudit(access.user.id, "couriers", "courier.archive", "courier", id);
  revalidatePath("/couriers");
}

// ── Courier login accounts (phone + PIN) ─────────────────────────────────────
// Minting a login creates a THIRD_PARTY User, so it needs MANAGE on couriers —
// a higher bar than the OPERATE that edits roster entries. The PIN never leaves
// this boundary in the clear: it's policy-checked, then hashed in the service.

/** MANAGE gates login management; a plain OPERATE courier-editor can't mint accounts. */
async function requireCourierManager() {
  const access = await requireUser();
  if (!access.canModule("couriers", "MANAGE")) return null;
  return access;
}

export async function createCourierLoginAction(courierId: number, phone: string, pin: string): Promise<LoginActionResult> {
  const access = await requireCourierManager();
  if (!access) return { ok: false, error: "You can't manage courier logins." };
  const pinErr = validatePin(pin);
  if (pinErr) return { ok: false, error: pinErr };
  const r = await createCourierLogin(courierId, phone, pin, access.user.id);
  if (!r.ok) return r;
  await writeAudit(access.user.id, "couriers", "courier.login.create", "courier", courierId, {});
  revalidatePath(`/couriers/${courierId}`);
  return { ok: true };
}

export async function resetCourierPinAction(courierId: number, pin: string): Promise<LoginActionResult> {
  const access = await requireCourierManager();
  if (!access) return { ok: false, error: "You can't manage courier logins." };
  const pinErr = validatePin(pin);
  if (pinErr) return { ok: false, error: pinErr };
  const r = await resetCourierPin(courierId, pin, access.user.id);
  if (!r.ok) return r;
  await writeAudit(access.user.id, "couriers", "courier.login.reset", "courier", courierId, {});
  revalidatePath(`/couriers/${courierId}`);
  return { ok: true };
}

export async function setCourierLoginActiveAction(courierId: number, active: boolean): Promise<LoginActionResult> {
  const access = await requireCourierManager();
  if (!access) return { ok: false, error: "You can't manage courier logins." };
  const r = await setCourierLoginActive(courierId, active, access.user.id);
  if (!r.ok) return r;
  await writeAudit(access.user.id, "couriers", active ? "courier.login.enable" : "courier.login.disable", "courier", courierId, {});
  revalidatePath(`/couriers/${courierId}`);
  return { ok: true };
}
