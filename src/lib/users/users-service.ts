import "server-only";
import { prisma } from "@/lib/db";
import { clean } from "@/lib/text";
import { hashPassword } from "@/lib/auth/password";
import { isLevel, type Level, type Tier } from "@/lib/auth/access-logic";

const TIERS: Tier[] = ["SUPER_ADMIN", "ADMIN", "MEMBER"];
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
  uid?: string; // employee number; doubles as the user UID
  fullName?: string;
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

/** Employee number doubles as the user UID: unique, prefixed YE1101. */
async function assertUidValid(uid: string | null, exceptId?: number) {
  if (!uid) return;
  if (!uid.startsWith("YE1101")) throw new Error("Employee number must start with YE1101.");
  const clash = await prisma.user.findFirst({
    where: { uid, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  if (clash) throw new Error("That employee number is already taken.");
}

export async function createUser(input: UserProfileInput & { password: string }) {
  const email = input.email.trim().toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) {
    throw new Error("A user with that email already exists.");
  }
  const username = clean(input.username);
  await assertUsernameFree(username);
  const uid = clean(input.uid);
  await assertUidValid(uid);
  const passwordHash = await hashPassword(input.password);
  return prisma.user.create({
    data: {
      uid,
      name: input.name.trim(),
      fullName: clean(input.fullName),
      username,
      email,
      tier: isTier(input.tier) ? input.tier : "MEMBER",
      passwordHash,
      primaryPhone: clean(input.primaryPhone),
      secondaryPhone: clean(input.secondaryPhone),
      yeldnPhone: clean(input.yeldnPhone),
      avatarUrl: input.avatarUrl || null,
    },
  });
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
      fullName: clean(input.fullName),
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
  return prisma.user.update({ where: { id }, data: { passwordHash } });
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
