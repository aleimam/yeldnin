"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { writeAudit } from "@/lib/audit";
import { canManageEmployee } from "@/lib/hr/hr-service";
import { generateDraft, recompute, addTargetLine, addAdhocLine, removeLine, lockPayslip, type AdhocInput } from "@/lib/hr/payroll-service";

export type PayrollResult = { ok: true } | { ok: false; error: string };

async function guard(employeeId: number) {
  const access = await requireUser();
  if (!(await canManageEmployee(access, employeeId))) redirect("/");
  return access;
}
function refresh(employeeId: number) {
  revalidatePath(`/hr/employees/${employeeId}`);
  revalidatePath("/hr/my-salary");
}

export async function generatePayslipAction(employeeId: number, year: number, month: number): Promise<PayrollResult> {
  const access = await guard(employeeId);
  if (!Number.isInteger(year) || month < 1 || month > 12) return { ok: false, error: "Choose a valid month." };
  try {
    const slip = await generateDraft(employeeId, year, month, access.user.id);
    await writeAudit(access.user.id, "human_resources", "payslip.generate", "employee", employeeId, { year, month });
    refresh(employeeId);
    return slip ? { ok: true } : { ok: false, error: "Could not generate." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not generate the payslip." };
  }
}

export async function recomputePayslipAction(employeeId: number, payslipId: number): Promise<PayrollResult> {
  await guard(employeeId);
  try {
    await recompute(payslipId);
    refresh(employeeId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not recompute." };
  }
}

export async function addTargetAction(employeeId: number, payslipId: number, componentId: number): Promise<PayrollResult> {
  await guard(employeeId);
  try {
    await addTargetLine(payslipId, componentId);
    refresh(employeeId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not add the target bonus." };
  }
}

export async function addAdhocAction(employeeId: number, payslipId: number, input: AdhocInput): Promise<PayrollResult> {
  await guard(employeeId);
  if (!input.label?.trim()) return { ok: false, error: "A label is required." };
  if (input.mode === "FIXED" && !(Number(input.amount) > 0)) return { ok: false, error: "Enter an amount." };
  if (input.mode === "DAYS" && !(Number(input.days) > 0)) return { ok: false, error: "Enter a number of days." };
  try {
    await addAdhocLine(payslipId, input);
    refresh(employeeId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not add the item." };
  }
}

export async function removeLineAction(employeeId: number, payslipId: number, lineId: number): Promise<PayrollResult> {
  await guard(employeeId);
  try {
    await removeLine(payslipId, lineId);
    refresh(employeeId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not remove the line." };
  }
}

export async function lockPayslipAction(employeeId: number, payslipId: number): Promise<PayrollResult> {
  const access = await guard(employeeId);
  try {
    await lockPayslip(payslipId, access.user.id);
    await writeAudit(access.user.id, "human_resources", "payslip.lock", "payslip", payslipId);
    refresh(employeeId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not lock the payslip." };
  }
}
