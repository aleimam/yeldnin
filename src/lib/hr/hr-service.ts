import "server-only";
import { prisma } from "@/lib/db";
import { nextUid } from "@/lib/uid";
import { clean } from "@/lib/text";
import { createUser } from "@/lib/users/users-service";
import { wouldCreateCycle } from "./hr-logic";

async function addEvent(employeeId: number, type: string, message: string, byUserId: number | null, photoAssetIds: string[] = []) {
  await prisma.employeeEvent.create({
    data: { employeeId, type, message, byUserId, photos: photoAssetIds.length ? { create: photoAssetIds.map((assetId) => ({ assetId })) } : undefined },
  });
}

/** Idempotently ensure a User has an Employee (strict 1:1). Returns the employee id. */
export async function ensureEmployee(userId: number, byUserId: number | null = null): Promise<number> {
  const existing = await prisma.employee.findUnique({ where: { userId }, select: { id: true } });
  if (existing) return existing.id;
  const uid = await nextUid("EMP");
  const emp = await prisma.employee.create({ data: { uid, userId, createdById: byUserId } });
  await addEvent(emp.id, "CREATED", "Employee record created.", byUserId);
  return emp.id;
}

export interface NewEmployeeInput {
  name: string;
  email: string;
  username?: string | null;
  password: string;
  tier?: string | null;
  nameAr?: string | null;
  fullName?: string | null;
  primaryPhone?: string | null;
  lineManagerId?: number | null;
  hiringDate?: string | null;
}

/** Create a user + its employee (strict 1:1), with optional initial HR fields. */
export async function createEmployeeWithUser(input: NewEmployeeInput, byUserId: number): Promise<{ userId: number; employeeId: number }> {
  const user = await createUser({
    name: input.name,
    nameAr: clean(input.nameAr) ?? undefined,
    fullName: clean(input.fullName) ?? undefined,
    username: clean(input.username) ?? undefined,
    email: input.email,
    tier: input.tier || "MEMBER",
    primaryPhone: clean(input.primaryPhone) ?? undefined,
    password: input.password,
  });
  const employeeId = await ensureEmployee(user.id, byUserId);
  if (input.lineManagerId != null || input.hiringDate) {
    await prisma.employee.update({
      where: { id: employeeId },
      data: { lineManagerId: input.lineManagerId ?? null, hiringDate: input.hiringDate ? new Date(input.hiringDate) : null },
    });
    if (input.lineManagerId != null) await addEvent(employeeId, "MANAGER_CHANGED", "Line manager assigned.", byUserId);
  }
  return { userId: user.id, employeeId };
}

export interface EmployeeProfileInput {
  nationalIdNumber?: string | null;
  nationalIdExpiry?: string | null;
  gradDegree?: string | null;
  gradUniversity?: string | null;
  gradFaculty?: string | null;
  birthDate?: string | null;
  hiringDate?: string | null;
  notes?: string | null;
}

/** Update the HR-specific profile fields (display name/email live on the User). */
export async function updateEmployee(id: number, input: EmployeeProfileInput, byUserId: number) {
  await prisma.employee.update({
    where: { id },
    data: {
      nationalIdNumber: clean(input.nationalIdNumber),
      nationalIdExpiry: input.nationalIdExpiry ? new Date(input.nationalIdExpiry) : null,
      gradDegree: clean(input.gradDegree),
      gradUniversity: clean(input.gradUniversity),
      gradFaculty: clean(input.gradFaculty),
      birthDate: input.birthDate ? new Date(input.birthDate) : null,
      hiringDate: input.hiringDate ? new Date(input.hiringDate) : null,
      notes: clean(input.notes),
      updatedById: byUserId,
    },
  });
  await addEvent(id, "PROFILE_EDIT", "Profile details updated.", byUserId);
}

/** Set/clear an employee's line manager (cycle-guarded). */
export async function setLineManager(employeeId: number, managerId: number | null, byUserId: number): Promise<{ ok: boolean; error?: string }> {
  if (managerId != null) {
    const all = await prisma.employee.findMany({ select: { id: true, lineManagerId: true } });
    const parent = new Map(all.map((e) => [e.id, e.lineManagerId]));
    if (wouldCreateCycle(employeeId, managerId, (id) => parent.get(id))) {
      return { ok: false, error: "That would create a management loop." };
    }
  }
  await prisma.employee.update({ where: { id: employeeId }, data: { lineManagerId: managerId, updatedById: byUserId } });
  await addEvent(employeeId, "MANAGER_CHANGED", managerId == null ? "Line manager cleared." : "Line manager changed.", byUserId);
  return { ok: true };
}

export async function addNote(employeeId: number, message: string, photoAssetIds: string[], byUserId: number) {
  await addEvent(employeeId, "NOTE", message.trim(), byUserId, photoAssetIds);
}

export async function addEmployeePhoto(employeeId: number, kind: string, assetId: string, label: string | null, byUserId: number) {
  await prisma.employeePhoto.create({ data: { employeeId, kind, assetId, label: clean(label) } });
  await addEvent(employeeId, "PROFILE_EDIT", "Document uploaded.", byUserId);
}

export function listEmployees() {
  return prisma.employee.findMany({
    where: { archivedAt: null },
    orderBy: { id: "asc" },
    include: {
      user: { select: { name: true, nameAr: true, email: true, active: true } },
      lineManager: { select: { user: { select: { name: true } } } },
      _count: { select: { reports: true } },
    },
  });
}

export function getEmployee(id: number) {
  return prisma.employee.findFirst({
    where: { id, archivedAt: null },
    include: {
      user: { select: { id: true, name: true, nameAr: true, fullName: true, email: true, username: true, primaryPhone: true, tier: true, active: true } },
      lineManager: { select: { id: true, user: { select: { name: true } } } },
      reports: { include: { user: { select: { name: true } } }, orderBy: { id: "asc" } },
      photos: { orderBy: { id: "asc" } },
      events: { orderBy: { createdAt: "desc" }, take: 50, include: { photos: true } },
    },
  });
}

export function getEmployeeByUserId(userId: number) {
  return prisma.employee.findUnique({ where: { userId }, select: { id: true } });
}

/** Employees available as a line-manager pick (id + name), excluding one id. */
export async function managerOptions(exceptId?: number): Promise<{ id: number; label: string }[]> {
  const emps = await prisma.employee.findMany({
    where: { archivedAt: null, ...(exceptId ? { id: { not: exceptId } } : {}) },
    include: { user: { select: { name: true } } },
    orderBy: { id: "asc" },
  });
  return emps.map((e) => ({ id: e.id, label: e.user?.name ?? `#${e.id}` }));
}

/** Company-wide life-events feed (HR audit). */
export function listCompanyEvents(take = 100) {
  return prisma.employeeEvent.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: { employee: { include: { user: { select: { name: true } } } } },
  });
}

/** Backfill: every user without an employee gets one (idempotent; seed-safe). */
export async function backfillEmployees(): Promise<number> {
  const users = await prisma.user.findMany({ where: { employee: { is: null } }, select: { id: true } });
  for (const u of users) await ensureEmployee(u.id, null);
  return users.length;
}

/** Relationship permission: is `actorUserId` the direct line manager of `employeeId`? */
export async function isDirectManagerOf(actorUserId: number, employeeId: number): Promise<boolean> {
  const actor = await prisma.employee.findUnique({ where: { userId: actorUserId }, select: { id: true } });
  if (!actor) return false;
  const target = await prisma.employee.findUnique({ where: { id: employeeId }, select: { lineManagerId: true } });
  return target?.lineManagerId != null && target.lineManagerId === actor.id;
}

/** Can this actor manage the given employee? Admin · HR-manage · direct line manager. */
export async function canManageEmployee(
  access: { isAdmin: boolean; can: (m: string, c: string) => boolean; user?: { id: number } | null },
  employeeId: number,
): Promise<boolean> {
  if (access.isAdmin || access.can("human_resources", "manage")) return true;
  const uid = access.user?.id;
  if (uid == null) return false;
  return isDirectManagerOf(uid, employeeId);
}
