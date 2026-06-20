"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { writeAudit } from "@/lib/audit";
import { isHolidayType, isComponentKind, isDayClass, validateLeaveRequest, type LeaveType } from "@/lib/hr/attendance-logic";
import { isValuation } from "@/lib/hr/salary-logic";
import { canManageEmployee, getEmployeeByUserId } from "@/lib/hr/hr-service";
import {
  createLeaveRequest,
  decideLeave,
  getLeaveRequest,
  markAbsence,
  clearAbsence,
  setEmployeeAllowance,
  setHrConfig,
  createHoliday,
  updateHoliday,
  archiveHoliday,
  setHolidayBonus,
  createSalaryComponent,
  updateSalaryComponent,
  archiveSalaryComponent,
  createDayType,
  updateDayType,
  archiveDayType,
  markDuty,
  clearDuty,
  setDutyMapping,
  type HolidayInput,
  type ComponentInput,
  type DayTypeInput,
} from "@/lib/hr/attendance-service";

async function requireHrManage() {
  const access = await requireUser();
  if (access.isAdmin || access.can("human_resources", "manage")) return access;
  redirect("/");
}

export type LeaveResult = { ok: true } | { ok: false; error: string };

/** Self-service: apply for leave on your own employee record. */
export async function applyLeaveAction(type: string, startDate: string, endDate: string, reason: string | null): Promise<LeaveResult> {
  const access = await requireUser();
  const emp = await getEmployeeByUserId(access.user.id);
  if (!emp) return { ok: false, error: "You don't have an employee record." };
  const errs = validateLeaveRequest({ type, startDate, endDate });
  if (Object.keys(errs).length) return { ok: false, error: Object.values(errs)[0] };
  try {
    await createLeaveRequest(emp.id, type as LeaveType, startDate, endDate, reason, access.user.id);
    revalidatePath("/hr/my-leave");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not submit the request." };
  }
}

export async function decideLeaveAction(id: number, approve: boolean, note: string | null): Promise<void> {
  const access = await requireUser();
  const lr = await getLeaveRequest(id);
  if (!lr) return;
  if (!(await canManageEmployee(access, lr.employeeId))) redirect("/");
  await decideLeave(id, approve, note, access.user.id);
  await writeAudit(access.user.id, "human_resources", approve ? "leave.approve" : "leave.decline", "leave", id);
  revalidatePath("/hr/attendance");
  revalidatePath("/hr/my-leave");
}

export async function markAbsenceAction(employeeId: number, date: string, note: string | null): Promise<void> {
  const access = await requireUser();
  if (!(await canManageEmployee(access, employeeId))) redirect("/");
  await markAbsence(employeeId, date, note, access.user.id);
  await writeAudit(access.user.id, "human_resources", "absence.mark", "employee", employeeId, { date });
  revalidatePath(`/hr/employees/${employeeId}`);
  revalidatePath("/hr/attendance");
}

export async function clearAbsenceAction(employeeId: number, date: string): Promise<void> {
  const access = await requireUser();
  if (!(await canManageEmployee(access, employeeId))) redirect("/");
  await clearAbsence(employeeId, date);
  revalidatePath(`/hr/employees/${employeeId}`);
  revalidatePath("/hr/attendance");
}

export async function setEmployeeAllowanceAction(employeeId: number, annual: number | null, urgent: number | null): Promise<void> {
  const access = await requireHrManage();
  await setEmployeeAllowance(employeeId, annual, urgent, access.user.id);
  revalidatePath(`/hr/employees/${employeeId}`);
}

export async function setHrConfigAction(annualDefault: number, urgentDefault: number, weeklyOffDays: string): Promise<void> {
  const access = await requireHrManage();
  await setHrConfig({ annualDefault, urgentDefault, weeklyOffDays }, access.user.id);
  revalidatePath("/hr/attendance");
}

export type HolidayResult = { ok: true; id: number } | { ok: false; error: string };

export async function createHolidayAction(input: HolidayInput): Promise<HolidayResult> {
  const access = await requireHrManage();
  if (!input.title?.trim()) return { ok: false, error: "Title is required." };
  if (!isHolidayType(input.type)) return { ok: false, error: "Choose a holiday type." };
  if (!input.startDate || !input.endDate) return { ok: false, error: "Dates are required." };
  if (input.endDate < input.startDate) return { ok: false, error: "End date must not be before the start date." };
  const h = await createHoliday(input, access.user.id);
  await writeAudit(access.user.id, "human_resources", "holiday.create", "holiday", h.id);
  revalidatePath("/hr/attendance");
  return { ok: true, id: h.id };
}

export async function updateHolidayAction(id: number, input: HolidayInput): Promise<void> {
  const access = await requireHrManage();
  await updateHoliday(id, input, access.user.id);
  revalidatePath("/hr/attendance");
}

export async function archiveHolidayAction(id: number): Promise<void> {
  const access = await requireHrManage();
  await archiveHoliday(id);
  await writeAudit(access.user.id, "human_resources", "holiday.archive", "holiday", id);
  revalidatePath("/hr/attendance");
}

export async function setHolidayBonusAction(holidayId: number, teamId: number, amountPerDay: number): Promise<void> {
  await requireHrManage();
  await setHolidayBonus(holidayId, teamId, amountPerDay);
  revalidatePath("/hr/attendance");
}

// ── Salary components (HR manage) ────────────────────────────────────────────
export type CatalogResult = { ok: true } | { ok: false; error: string };

export async function createComponentAction(input: ComponentInput): Promise<CatalogResult> {
  const access = await requireHrManage();
  if (!input.code?.trim() || !input.name?.trim()) return { ok: false, error: "Code and name are required." };
  if (!isComponentKind(input.kind)) return { ok: false, error: "Choose Earning, Bonus or Penalty." };
  if (!isValuation(input.valuation)) return { ok: false, error: "Choose how the figure is valued." };
  try {
    await createSalaryComponent(input, access.user.id);
    revalidatePath("/hr/setup");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not save (code may already exist)." };
  }
}
export async function updateComponentAction(id: number, input: Omit<ComponentInput, "code">): Promise<void> {
  await requireHrManage();
  await updateSalaryComponent(id, input);
  revalidatePath("/hr/setup");
}
export async function archiveComponentAction(id: number): Promise<void> {
  await requireHrManage();
  await archiveSalaryComponent(id);
  revalidatePath("/hr/setup");
}

// ── Day types (HR manage) ────────────────────────────────────────────────────
export async function createDayTypeAction(input: DayTypeInput): Promise<CatalogResult> {
  const access = await requireHrManage();
  if (!input.code?.trim() || !input.name?.trim()) return { ok: false, error: "Code and name are required." };
  if (!isDayClass(input.dayClass)) return { ok: false, error: "Choose Leave or Duty." };
  try {
    await createDayType(input, access.user.id);
    revalidatePath("/hr/setup");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not save (code may already exist)." };
  }
}
export async function updateDayTypeAction(id: number, input: Omit<DayTypeInput, "code">): Promise<void> {
  await requireHrManage();
  await updateDayType(id, input);
  revalidatePath("/hr/setup");
}
export async function archiveDayTypeAction(id: number): Promise<void> {
  await requireHrManage();
  await archiveDayType(id);
  revalidatePath("/hr/setup");
}

export async function setDutyMappingAction(dutyEidDays: string, dutyEidVacation: string, dutyVacation: string, dutyWeekend: string): Promise<void> {
  const access = await requireHrManage();
  await setDutyMapping({ dutyEidDays, dutyEidVacation, dutyVacation, dutyWeekend }, access.user.id);
  revalidatePath("/hr/setup");
}

// ── Duty days (worked a non-working day / training) ──────────────────────────
export async function markDutyAction(employeeId: number, date: string, dayTypeId: number, note: string | null): Promise<void> {
  const access = await requireUser();
  if (!(await canManageEmployee(access, employeeId))) redirect("/");
  await markDuty(employeeId, date, dayTypeId, note, access.user.id);
  revalidatePath(`/hr/employees/${employeeId}`);
}
export async function clearDutyAction(employeeId: number, date: string): Promise<void> {
  const access = await requireUser();
  if (!(await canManageEmployee(access, employeeId))) redirect("/");
  await clearDuty(employeeId, date);
  revalidatePath(`/hr/employees/${employeeId}`);
}
