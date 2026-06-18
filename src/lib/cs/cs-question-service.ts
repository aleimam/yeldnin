import "server-only";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { clampWeight } from "./cs-logic";

/** Questions for the admin pool (and to drive evaluations). */
export function listCsQuestions(opts?: { scope?: string; typeId?: number; activeOnly?: boolean; includeArchived?: boolean }) {
  return prisma.csQuestion.findMany({
    where: {
      ...(opts?.includeArchived ? {} : { archivedAt: null }),
      ...(opts?.scope ? { scope: opts.scope } : {}),
      ...(opts?.typeId ? { typeId: opts.typeId } : {}),
      ...(opts?.activeOnly ? { active: true } : {}),
    },
    orderBy: [{ scope: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
    include: { type: { select: { id: true, name: true, scope: true } } },
  });
}

export interface CsQuestionInput {
  criteria: string;
  weight: number;
  scope: string;
  typeId: number;
  active: boolean;
}

export async function createCsQuestion(input: CsQuestionInput, userId: number) {
  const max = await prisma.csQuestion.aggregate({ _max: { sortOrder: true }, where: { scope: input.scope } });
  const q = await prisma.csQuestion.create({
    data: {
      criteria: input.criteria.trim(),
      weight: clampWeight(input.weight),
      scope: input.scope,
      typeId: input.typeId,
      active: input.active,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
      createdById: userId,
    },
  });
  await writeAudit(userId, "cs_quality", "question.create", "csQuestion", q.id, {});
  return q;
}

export async function updateCsQuestion(id: number, input: CsQuestionInput, userId: number) {
  await prisma.csQuestion.update({
    where: { id },
    data: {
      criteria: input.criteria.trim(),
      weight: clampWeight(input.weight),
      scope: input.scope,
      typeId: input.typeId,
      active: input.active,
      updatedById: userId,
    },
  });
  await writeAudit(userId, "cs_quality", "question.update", "csQuestion", id, {});
}

/** Soft-delete (past evaluations keep their snapshots). */
export async function archiveCsQuestion(id: number, userId: number) {
  await prisma.csQuestion.update({ where: { id }, data: { archivedAt: new Date(), active: false } });
  await writeAudit(userId, "cs_quality", "question.archive", "csQuestion", id, {});
}
