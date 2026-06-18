import "server-only";
import { prisma } from "@/lib/db";

export function listTeamsWithCounts() {
  return prisma.team.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { members: true } } },
  });
}

export function getTeamDetail(id: number) {
  return prisma.team.findUnique({
    where: { id },
    include: {
      members: { include: { user: { select: { id: true, name: true, nameAr: true, email: true } } } },
    },
  });
}

export function listAllUsers() {
  return prisma.user.findMany({
    where: { archivedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, nameAr: true, email: true },
  });
}

function slugify(name: string): string {
  return (
    name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "team"
  );
}

/** Create a team; the internal key is auto-slugged from the name (uniqueness enforced). */
export async function createTeam(name: string) {
  const base = slugify(name);
  let key = base;
  let n = 2;
  while (await prisma.team.findUnique({ where: { key } })) key = `${base}-${n++}`;
  return prisma.team.create({ data: { key, name: name.trim() } });
}

export function renameTeam(id: number, name: string) {
  return prisma.team.update({ where: { id }, data: { name: name.trim() } });
}

export async function addMember(teamId: number, userId: number) {
  await prisma.teamMember.upsert({
    where: { teamId_userId: { teamId, userId } },
    update: {},
    create: { teamId, userId },
  });
}

export function removeMember(teamId: number, userId: number) {
  return prisma.teamMember.deleteMany({ where: { teamId, userId } });
}

export function deleteTeam(id: number) {
  return prisma.team.delete({ where: { id } });
}
