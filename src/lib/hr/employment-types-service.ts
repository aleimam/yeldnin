import "server-only";
import { prisma } from "@/lib/db";
import { clean } from "@/lib/text";

// ── Salary types & employee types ────────────────────────────────────────────
// Two small admin-editable catalogs surfaced in /hr/setup. Salary Type is a pure
// label; Employee Type carries `payrollEligible`, which decides whether the
// payroll run includes employees of that type. Soft-delete (archivedAt) over
// hard-delete so an archived type assigned to an employee keeps resolving.

export function listSalaryTypes(includeArchived = false) {
  return prisma.salaryType.findMany({
    where: includeArchived ? {} : { archivedAt: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function createSalaryType(input: { name: string; nameAr?: string | null }, byUserId: number) {
  const name = input.name.trim();
  if (!name) throw new Error("A name is required.");
  await prisma.salaryType.create({ data: { name, nameAr: clean(input.nameAr), createdById: byUserId } });
}

export async function updateSalaryType(id: number, input: { name: string; nameAr?: string | null }, byUserId: number) {
  const name = input.name.trim();
  if (!name) throw new Error("A name is required.");
  await prisma.salaryType.update({ where: { id }, data: { name, nameAr: clean(input.nameAr), updatedById: byUserId } });
}

export async function archiveSalaryType(id: number, byUserId: number) {
  await prisma.salaryType.update({ where: { id }, data: { archivedAt: new Date(), updatedById: byUserId } });
}

export function listEmployeeTypes(includeArchived = false) {
  return prisma.employeeType.findMany({
    where: includeArchived ? {} : { archivedAt: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function createEmployeeType(
  input: { name: string; nameAr?: string | null; payrollEligible: boolean },
  byUserId: number,
) {
  const name = input.name.trim();
  if (!name) throw new Error("A name is required.");
  await prisma.employeeType.create({
    data: { name, nameAr: clean(input.nameAr), payrollEligible: input.payrollEligible, createdById: byUserId },
  });
}

export async function updateEmployeeType(
  id: number,
  input: { name: string; nameAr?: string | null; payrollEligible: boolean },
  byUserId: number,
) {
  const name = input.name.trim();
  if (!name) throw new Error("A name is required.");
  await prisma.employeeType.update({
    where: { id },
    data: { name, nameAr: clean(input.nameAr), payrollEligible: input.payrollEligible, updatedById: byUserId },
  });
}

export async function archiveEmployeeType(id: number, byUserId: number) {
  await prisma.employeeType.update({ where: { id }, data: { archivedAt: new Date(), updatedById: byUserId } });
}
