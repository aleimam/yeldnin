import "server-only";
import { prisma } from "@/lib/db";
import { nextUid } from "@/lib/uid";
import { clean } from "@/lib/text";
import { hashPassword } from "@/lib/auth/password";
import { createUserTx } from "@/lib/users/users-service";
import { wouldCreateCycle, isValidEmployeeNumber } from "./hr-logic";

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
  // The user and the employee must be created together. A half-done create — user
  // inserted, employee insert then fails — would orphan the user, break the strict
  // 1:1, and block any retry because the email is now taken. Hash the password and
  // reserve the employee UID up-front (bcrypt + the Counter write stay outside the
  // write transaction, so we never hold SQLite's single writer during them), then
  // do both inserts and their events in one atomic transaction.
  const passwordHash = await hashPassword(input.password);
  const uid = await nextUid("EMP");
  return prisma.$transaction(async (tx) => {
    const user = await createUserTx(tx, {
      name: input.name,
      nameAr: clean(input.nameAr) ?? undefined,
      fullName: clean(input.fullName) ?? undefined,
      username: clean(input.username) ?? undefined,
      email: input.email,
      tier: input.tier || "MEMBER",
      primaryPhone: clean(input.primaryPhone) ?? undefined,
      passwordHash,
    });
    const emp = await tx.employee.create({
      data: {
        uid,
        userId: user.id,
        createdById: byUserId,
        lineManagerId: input.lineManagerId ?? null,
        hiringDate: input.hiringDate ? new Date(input.hiringDate) : null,
      },
    });
    await tx.employeeEvent.create({ data: { employeeId: emp.id, type: "CREATED", message: "Employee record created.", byUserId } });
    if (input.lineManagerId != null) {
      await tx.employeeEvent.create({ data: { employeeId: emp.id, type: "MANAGER_CHANGED", message: "Line manager assigned.", byUserId } });
    }
    return { userId: user.id, employeeId: emp.id };
  });
}

export interface EmployeeProfileInput {
  nationalIdNumber?: string | null;
  nationalIdExpiry?: string | null;
  gradDegree?: string | null;
  gradUniversity?: string | null;
  gradFaculty?: string | null;
  birthDate?: string | null;
  gender?: string | null;
  hiringDate?: string | null;
  bank?: string | null;
  accountNo?: string | null;
  salaryTypeId?: number | null;
  employeeTypeId?: number | null;
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
      gender: clean(input.gender),
      hiringDate: input.hiringDate ? new Date(input.hiringDate) : null,
      bank: clean(input.bank),
      accountNo: clean(input.accountNo),
      salaryTypeId: input.salaryTypeId ?? null,
      employeeTypeId: input.employeeTypeId ?? null,
      notes: clean(input.notes),
      updatedById: byUserId,
    },
  });
  await addEvent(id, "PROFILE_EDIT", "Profile details updated.", byUserId);
}

export interface EmployeeIdentityInput {
  name: string;
  nameAr?: string | null;
  fullName?: string | null;
  fullNameAr?: string | null;
  email: string;
  uid?: string | null; // employee number (YE####)
  primaryPhone?: string | null;
  secondaryPhone?: string | null;
  yeldnPhone?: string | null;
  positionId?: number | null;
}

/** Update the identity fields that live on the linked User (single source of
 *  truth — edits here reflect on the user page) plus the employee's position.
 *  Email + employee number uniqueness enforced. Atomic. */
export async function updateEmployeeIdentity(employeeId: number, input: EmployeeIdentityInput, byUserId: number) {
  const emp = await prisma.employee.findUnique({ where: { id: employeeId }, select: { userId: true } });
  if (!emp) throw new Error("Employee not found.");
  const email = input.email.trim().toLowerCase();
  if (await prisma.user.findFirst({ where: { email, id: { not: emp.userId } }, select: { id: true } })) {
    throw new Error("A user with that email already exists.");
  }
  const uid = clean(input.uid);
  if (uid) {
    if (!isValidEmployeeNumber(uid)) throw new Error("Employee number must look like YE1101.");
    if (await prisma.user.findFirst({ where: { uid, id: { not: emp.userId } }, select: { id: true } })) {
      throw new Error("That employee number is already taken.");
    }
  }
  await prisma.$transaction([
    prisma.user.update({
      where: { id: emp.userId },
      data: {
        name: input.name.trim(),
        nameAr: clean(input.nameAr),
        fullName: clean(input.fullName),
        fullNameAr: clean(input.fullNameAr),
        email,
        uid,
        primaryPhone: clean(input.primaryPhone),
        secondaryPhone: clean(input.secondaryPhone),
        yeldnPhone: clean(input.yeldnPhone),
      },
    }),
    prisma.employee.update({ where: { id: employeeId }, data: { positionId: input.positionId ?? null, updatedById: byUserId } }),
  ]);
  await addEvent(employeeId, "PROFILE_EDIT", "Identity & position updated.", byUserId);
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
      user: { select: { uid: true, name: true, nameAr: true, email: true, active: true } },
      position: { select: { title: true, titleAr: true } },
      lineManager: { select: { user: { select: { name: true } } } },
      _count: { select: { reports: true } },
    },
  });
}

export function getEmployee(id: number) {
  return prisma.employee.findFirst({
    where: { id, archivedAt: null },
    include: {
      user: {
        select: {
          id: true, uid: true, name: true, nameAr: true, fullName: true, fullNameAr: true, email: true, username: true,
          primaryPhone: true, secondaryPhone: true, yeldnPhone: true, tier: true, active: true,
          teamMembers: { select: { team: { select: { name: true } } } }, // department(s) = team membership
        },
      },
      position: { select: { id: true, title: true, titleAr: true } },
      salaryType: { select: { id: true, name: true, nameAr: true } },
      employeeType: { select: { id: true, name: true, nameAr: true } },
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
