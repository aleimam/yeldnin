"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { writeAudit } from "@/lib/audit";
import { validateNewEmployee } from "@/lib/hr/hr-logic";
import {
  createEmployeeWithUser,
  updateEmployee,
  setLineManager,
  addNote,
  addEmployeePhoto,
  canManageEmployee,
  type EmployeeProfileInput,
  type NewEmployeeInput,
} from "@/lib/hr/hr-service";

/** Creating staff = HR operate (or admin). */
async function requireHrCreate() {
  const access = await requireUser();
  if (access.isAdmin || access.can("human_resources", "operate")) return access;
  redirect("/");
}
/** Editing the org hierarchy = HR manage (or admin). */
async function requireHrManage() {
  const access = await requireUser();
  if (access.isAdmin || access.can("human_resources", "manage")) return access;
  redirect("/");
}
/** Editing one employee's profile = admin · HR-manage · their direct manager. */
async function requireManage(employeeId: number) {
  const access = await requireUser();
  if (await canManageEmployee(access, employeeId)) return access;
  redirect("/");
}

export type HrResult = { ok: true; id: number } | { ok: false; error: string };

export async function createEmployeeAction(input: NewEmployeeInput): Promise<HrResult> {
  const access = await requireHrCreate();
  const errs = validateNewEmployee({ name: input.name, email: input.email });
  if (Object.keys(errs).length) return { ok: false, error: Object.values(errs)[0] };
  if (!input.password || input.password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };
  try {
    const { employeeId } = await createEmployeeWithUser(input, access.user.id);
    await writeAudit(access.user.id, "human_resources", "employee.create", "employee", employeeId, { email: input.email });
    revalidatePath("/hr/employees");
    return { ok: true, id: employeeId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not create the employee." };
  }
}

export async function updateEmployeeAction(id: number, input: EmployeeProfileInput): Promise<void> {
  const access = await requireManage(id);
  await updateEmployee(id, input, access.user.id);
  await writeAudit(access.user.id, "human_resources", "employee.update", "employee", id);
  revalidatePath(`/hr/employees/${id}`);
}

export async function setLineManagerAction(id: number, managerId: number | null): Promise<{ ok: boolean; error?: string }> {
  const access = await requireHrManage();
  const res = await setLineManager(id, managerId, access.user.id);
  if (res.ok) await writeAudit(access.user.id, "human_resources", "employee.setManager", "employee", id, { managerId });
  revalidatePath(`/hr/employees/${id}`);
  revalidatePath("/hr/hierarchy");
  return res;
}

export async function addNoteAction(id: number, message: string, photoAssetIds: string[]): Promise<void> {
  const access = await requireManage(id);
  if (message.trim()) await addNote(id, message, photoAssetIds, access.user.id);
  revalidatePath(`/hr/employees/${id}`);
}

export async function addEmployeePhotoAction(id: number, kind: string, assetId: string, label: string | null): Promise<void> {
  const access = await requireManage(id);
  await addEmployeePhoto(id, kind, assetId, label, access.user.id);
  revalidatePath(`/hr/employees/${id}`);
}
