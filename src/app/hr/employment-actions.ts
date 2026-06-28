"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { writeAudit } from "@/lib/audit";
import {
  createSalaryType,
  updateSalaryType,
  archiveSalaryType,
  createEmployeeType,
  updateEmployeeType,
  archiveEmployeeType,
} from "@/lib/hr/employment-types-service";

/** Editing the HR catalogs = HR manage (or admin). */
async function requireHrManage() {
  const access = await requireUser();
  if (access.isAdmin || access.can("human_resources", "manage")) return access;
  redirect("/");
}

type Result = { ok: true } | { ok: false; error: string };

async function run(label: string, fn: (userId: number) => Promise<void>): Promise<Result> {
  const access = await requireHrManage();
  try {
    await fn(access.user.id);
    await writeAudit(access.user.id, "human_resources", label, "employmentType", "catalog");
    revalidatePath("/hr/setup");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not save." };
  }
}

// ── Salary types ─────────────────────────────────────────────────────────────
export async function createSalaryTypeAction(input: { name: string; nameAr?: string | null }) {
  return run("salaryType.create", (uid) => createSalaryType(input, uid));
}
export async function updateSalaryTypeAction(id: number, input: { name: string; nameAr?: string | null }) {
  return run("salaryType.update", (uid) => updateSalaryType(id, input, uid));
}
export async function archiveSalaryTypeAction(id: number) {
  return run("salaryType.archive", (uid) => archiveSalaryType(id, uid));
}

// ── Employee types ───────────────────────────────────────────────────────────
export async function createEmployeeTypeAction(input: { name: string; nameAr?: string | null; payrollEligible: boolean }) {
  return run("employeeType.create", (uid) => createEmployeeType(input, uid));
}
export async function updateEmployeeTypeAction(id: number, input: { name: string; nameAr?: string | null; payrollEligible: boolean }) {
  return run("employeeType.update", (uid) => updateEmployeeType(id, input, uid));
}
export async function archiveEmployeeTypeAction(id: number) {
  return run("employeeType.archive", (uid) => archiveEmployeeType(id, uid));
}
