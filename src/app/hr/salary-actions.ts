"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { writeAudit } from "@/lib/audit";
import { isChangeType, validateChange, type ChangeType } from "@/lib/hr/salary-logic";
import { canManageEmployee } from "@/lib/hr/hr-service";
import { applyLineChange, setLineActive, bulkRaise } from "@/lib/hr/salary-service";

export type SalaryResult = { ok: true } | { ok: false; error: string };
export type BulkResult = { ok: true; count: number } | { ok: false; error: string };

async function requireHrManage() {
  const access = await requireUser();
  if (access.isAdmin || access.can("human_resources", "manage")) return access;
  redirect("/");
}

/** Add a component to / set / raise an employee's salary line. canManageEmployee. */
export async function applyLineChangeAction(
  employeeId: number,
  componentId: number,
  type: string,
  delta: number,
  effectiveDate: string,
  reason: string | null,
): Promise<SalaryResult> {
  const access = await requireUser();
  if (!(await canManageEmployee(access, employeeId))) redirect("/");
  if (!isChangeType(type)) return { ok: false, error: "Choose how to apply the change." };
  const errs = validateChange({ type, delta, effectiveDate });
  if (Object.keys(errs).length) return { ok: false, error: Object.values(errs)[0] };
  try {
    await applyLineChange({ employeeId, componentId, type: type as ChangeType, delta, effectiveDate, reason, byUserId: access.user.id });
    await writeAudit(access.user.id, "human_resources", "salary.change", "employee", employeeId, { componentId, type, delta });
    revalidatePath(`/hr/employees/${employeeId}`);
    revalidatePath("/hr/my-salary");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not apply the change." };
  }
}

/** Enable/disable a structure line. canManageEmployee. */
export async function setLineActiveAction(employeeId: number, lineId: number, active: boolean): Promise<void> {
  const access = await requireUser();
  if (!(await canManageEmployee(access, employeeId))) redirect("/");
  await setLineActive(lineId, active, access.user.id);
  revalidatePath(`/hr/employees/${employeeId}`);
  revalidatePath("/hr/my-salary");
}

/** Bulk raise: one component across a team (or everyone with it). HR-manage only. */
export async function bulkRaiseAction(
  componentId: number,
  teamId: number | null,
  type: string,
  delta: number,
  effectiveDate: string,
  reason: string | null,
): Promise<BulkResult> {
  const access = await requireHrManage();
  if (!isChangeType(type)) return { ok: false, error: "Choose how to apply the change." };
  const errs = validateChange({ type, delta, effectiveDate });
  if (Object.keys(errs).length) return { ok: false, error: Object.values(errs)[0] };
  try {
    const { count, batchId } = await bulkRaise({ componentId, teamId, type: type as ChangeType, delta, effectiveDate, reason, byUserId: access.user.id });
    await writeAudit(access.user.id, "human_resources", "salary.bulkRaise", "component", componentId, { teamId, type, delta, count, batchId });
    revalidatePath("/hr/setup");
    return { ok: true, count };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not apply the bulk raise." };
  }
}
