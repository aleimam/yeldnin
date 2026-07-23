import "server-only";
import { prisma } from "@/lib/db";
import { clean } from "@/lib/text";

const SCOPES = ["ANY", "CONNECTED", "SAME_DEPT"];
const scope = (s: unknown) => (typeof s === "string" && SCOPES.includes(s) ? s : "ANY");

export interface CriterionView {
  id: number;
  title: string;
  titleAr: string | null;
  text: string;
  textAr: string | null;
  raterScope: string;
  sortOrder: number;
}
export interface PillarView {
  id: number;
  name: string;
  nameAr: string | null;
  sortOrder: number;
  teamIds: number[];
  criteria: CriterionView[];
}

/** The full pillar/criteria config + the team list for applicability pickers. */
export async function listConfig(): Promise<{ pillars: PillarView[]; teams: { id: number; name: string }[] }> {
  const [pillars, teams] = await Promise.all([
    prisma.evalPillar.findMany({
      where: { archivedAt: null },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      include: {
        teams: { select: { teamId: true } },
        criteria: {
          where: { archivedAt: null },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          select: { id: true, title: true, titleAr: true, text: true, textAr: true, raterScope: true, sortOrder: true },
        },
      },
    }),
    prisma.team.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return {
    pillars: pillars.map((p) => ({
      id: p.id,
      name: p.name,
      nameAr: p.nameAr,
      sortOrder: p.sortOrder,
      teamIds: p.teams.map((t) => t.teamId),
      criteria: p.criteria,
    })),
    teams,
  };
}

export async function createPillar(input: { name: string; nameAr?: string | null }): Promise<void> {
  if (!input.name.trim()) throw new Error("Pillar name is required.");
  const max = await prisma.evalPillar.aggregate({ _max: { sortOrder: true } });
  await prisma.evalPillar.create({ data: { name: input.name.trim(), nameAr: clean(input.nameAr), sortOrder: (max._max.sortOrder ?? 0) + 1 } });
}

export async function updatePillar(id: number, input: { name: string; nameAr?: string | null; teamIds: number[] }): Promise<void> {
  if (!input.name.trim()) throw new Error("Pillar name is required.");
  const ids = [...new Set(input.teamIds.filter((n) => Number.isInteger(n)))];
  await prisma.$transaction(async (tx) => {
    await tx.evalPillar.update({ where: { id }, data: { name: input.name.trim(), nameAr: clean(input.nameAr) } });
    await tx.evalPillarTeam.deleteMany({ where: { pillarId: id } });
    if (ids.length) await tx.evalPillarTeam.createMany({ data: ids.map((teamId) => ({ pillarId: id, teamId })) });
  });
}

export async function archivePillar(id: number): Promise<void> {
  await prisma.evalPillar.update({ where: { id }, data: { archivedAt: new Date() } });
}

export async function createCriterion(input: { pillarId: number; title: string; text: string }): Promise<void> {
  if (!input.title.trim()) throw new Error("Criterion title is required.");
  const max = await prisma.evalCriterion.aggregate({ where: { pillarId: input.pillarId }, _max: { sortOrder: true } });
  await prisma.evalCriterion.create({
    data: { pillarId: input.pillarId, title: input.title.trim(), text: input.text.trim() || input.title.trim(), sortOrder: (max._max.sortOrder ?? 0) + 1 },
  });
}

export async function updateCriterion(
  id: number,
  input: { title: string; titleAr?: string | null; text: string; textAr?: string | null; raterScope: string },
): Promise<void> {
  if (!input.title.trim()) throw new Error("Criterion title is required.");
  await prisma.evalCriterion.update({
    where: { id },
    data: {
      title: input.title.trim(),
      titleAr: clean(input.titleAr),
      text: input.text.trim() || input.title.trim(),
      textAr: clean(input.textAr),
      raterScope: scope(input.raterScope),
    },
  });
}

export async function archiveCriterion(id: number): Promise<void> {
  await prisma.evalCriterion.update({ where: { id }, data: { archivedAt: new Date() } });
}
