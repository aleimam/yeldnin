import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { clean } from "@/lib/text";
import { hashPassword } from "@/lib/auth/password";
import { isLevel, type Level, type Tier } from "@/lib/auth/access-logic";
import { nextEmployeeNumber, isValidEmployeeNumber, isAdminTier } from "@/lib/hr/hr-logic";

/** A Prisma client bound to an open transaction (interactive `$transaction`). */
export type Tx = Prisma.TransactionClient;

const TIERS: Tier[] = ["SUPER_ADMIN", "ADMIN", "MEMBER", "THIRD_PARTY"];
export function isTier(v: string): v is Tier {
  return (TIERS as string[]).includes(v);
}

export function listUsers() {
  return prisma.user.findMany({
    where: { archivedAt: null },
    orderBy: { name: "asc" },
    include: {
      teamMembers: { include: { team: true } },
      _count: { select: { modulePerms: true } },
    },
  });
}

export function getUserDetail(id: number) {
  return prisma.user.findFirst({
    where: { id, archivedAt: null },
    include: {
      teamMembers: { include: { team: true } },
      modulePerms: true,
      employee: { select: { id: true } },
    },
  });
}

export function listTeams() {
  return prisma.team.findMany({ orderBy: { name: "asc" } });
}

export function activeSuperAdminCount(): Promise<number> {
  return prisma.user.count({
    where: { tier: "SUPER_ADMIN", active: true, archivedAt: null },
  });
}

export async function getUserTier(id: number): Promise<string | null> {
  const u = await prisma.user.findUnique({ where: { id }, select: { tier: true } });
  return u?.tier ?? null;
}

export interface UserProfileInput {
  name: string;
  nameAr?: string; // Arabic display name
  uid?: string; // employee number; doubles as the user UID
  fullName?: string;
  fullNameAr?: string; // Arabic official full name
  username?: string;
  email: string;
  tier: string;
  primaryPhone?: string;
  secondaryPhone?: string;
  yeldnPhone?: string;
  avatarUrl?: string | null;
}

async function assertUsernameFree(username: string | null, exceptId?: number) {
  if (!username) return;
  const clash = await prisma.user.findFirst({
    where: { username, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  if (clash) throw new Error("That username is already taken.");
}

/** Employee number doubles as the user UID: unique, formatted YE#### (e.g. YE1101). */
async function assertUidValid(uid: string | null, exceptId?: number) {
  if (!uid) return;
  if (!isValidEmployeeNumber(uid)) throw new Error("Employee number must look like YE1101.");
  const clash = await prisma.user.findFirst({
    where: { uid, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  if (clash) throw new Error("That employee number is already taken.");
}

/**
 * Create a user *inside a caller-supplied transaction*. The password must be
 * pre-hashed (bcrypt is async CPU work — keep it out of the write transaction).
 * Validation reads run on the same `tx` so uniqueness is checked against the
 * transaction's own view. Exposed so callers that must create a user and its
 * dependents atomically (e.g. an employee) can share one transaction.
 */
export async function createUserTx(tx: Tx, input: UserProfileInput & { passwordHash: string }) {
  const email = input.email.trim().toLowerCase();
  if (await tx.user.findFirst({ where: { email } })) {
    throw new Error("A user with that email already exists.");
  }
  const username = clean(input.username);
  if (username && (await tx.user.findFirst({ where: { username }, select: { id: true } }))) {
    throw new Error("That username is already taken.");
  }
  let uid = clean(input.uid);
  if (uid) {
    if (!isValidEmployeeNumber(uid)) throw new Error("Employee number must look like YE1101.");
    if (await tx.user.findFirst({ where: { uid }, select: { id: true } })) {
      throw new Error("That employee number is already taken.");
    }
  } else if (input.tier !== "THIRD_PARTY") {
    // Auto-assign the next number in the tier's band (admins 1001+, staff 1101+).
    const used = await tx.user.findMany({ where: { uid: { not: null } }, select: { uid: true } });
    uid = nextEmployeeNumber(used.map((u) => u.uid), isAdminTier(input.tier));
  }
  return tx.user.create({
    data: {
      uid,
      name: input.name.trim(),
      nameAr: clean(input.nameAr),
      fullName: clean(input.fullName),
      fullNameAr: clean(input.fullNameAr),
      username,
      email,
      tier: isTier(input.tier) ? input.tier : "MEMBER",
      passwordHash: input.passwordHash,
      primaryPhone: clean(input.primaryPhone),
      secondaryPhone: clean(input.secondaryPhone),
      yeldnPhone: clean(input.yeldnPhone),
      avatarUrl: input.avatarUrl || null,
    },
  });
}

export async function createUser(input: UserProfileInput & { password: string }) {
  const passwordHash = await hashPassword(input.password);
  return prisma.$transaction((tx) => createUserTx(tx, { ...input, passwordHash }));
}

export async function updateUserProfile(id: number, input: UserProfileInput & { active: boolean }) {
  const email = input.email.trim().toLowerCase();
  const clash = await prisma.user.findFirst({ where: { email, id: { not: id } }, select: { id: true } });
  if (clash) throw new Error("A user with that email already exists.");
  const username = clean(input.username);
  await assertUsernameFree(username, id);
  const uid = clean(input.uid);
  await assertUidValid(uid, id);
  return prisma.user.update({
    where: { id },
    data: {
      uid,
      name: input.name.trim(),
      nameAr: clean(input.nameAr),
      fullName: clean(input.fullName),
      fullNameAr: clean(input.fullNameAr),
      username,
      email,
      tier: isTier(input.tier) ? input.tier : "MEMBER",
      active: input.active,
      primaryPhone: clean(input.primaryPhone),
      secondaryPhone: clean(input.secondaryPhone),
      yeldnPhone: clean(input.yeldnPhone),
      avatarUrl: input.avatarUrl ?? null,
    },
  });
}

export async function setUserPassword(id: number, password: string) {
  const passwordHash = await hashPassword(password);
  // Bump tokenVersion so every existing session token for this user is invalidated,
  // and clear any failed-login lockout.
  return prisma.user.update({
    where: { id },
    data: { passwordHash, tokenVersion: { increment: 1 }, failedLogins: 0, lockedUntil: null },
  });
}

export async function setUserTeams(id: number, teamKeys: string[]) {
  const teams = await prisma.team.findMany({
    where: { key: { in: teamKeys } },
  });
  await prisma.$transaction([
    prisma.teamMember.deleteMany({ where: { userId: id } }),
    prisma.teamMember.createMany({
      data: teams.map((t) => ({ userId: id, teamId: t.id })),
    }),
  ]);
}

/** Replace a user's per-module levels. Non-NONE entries only are stored. */
export async function setUserModuleLevels(
  id: number,
  levels: Record<string, string>,
) {
  const rows = Object.entries(levels)
    .filter(([, lvl]) => isLevel(lvl) && lvl !== "NONE")
    .map(([moduleKey, level]) => ({ userId: id, moduleKey, level: level as Level }));
  await prisma.$transaction([
    prisma.userModulePermission.deleteMany({ where: { userId: id } }),
    ...(rows.length
      ? [prisma.userModulePermission.createMany({ data: rows })]
      : []),
  ]);
}
