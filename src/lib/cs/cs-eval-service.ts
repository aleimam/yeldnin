import "server-only";
import { prisma } from "@/lib/db";
import { nextUid } from "@/lib/uid";
import { getCsConfig } from "./cs-config-service";
import { valueFor, weightedTotal, normalizedPct } from "./cs-logic";

/** Sales reps = active users holding an order_requests permission. */
export async function listRepOptions(): Promise<{ id: number; name: string }[]> {
  const users = await prisma.user.findMany({
    where: {
      active: true,
      archivedAt: null,
      modulePerms: { some: { moduleKey: "order_requests", level: { not: "NONE" } } },
    },
    select: { id: true, name: true, fullName: true },
    orderBy: { name: "asc" },
  });
  return users.map((u) => ({ id: u.id, name: u.fullName || u.name }));
}

/** Active questions for a scope (Call filtered by type; Periodical = all). */
export async function questionsForScope(scope: string, typeId?: number) {
  return prisma.csQuestion.findMany({
    where: { archivedAt: null, active: true, scope, ...(typeId ? { typeId } : {}) },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: { type: { select: { id: true, name: true } } },
  });
}

export interface EvalAnswerInput {
  questionId: number;
  level: string;
  note?: string | null;
}
export interface CreateEvalInput {
  subjectUserId: number;
  scope: string;
  typeName?: string | null; // call type (null for performance)
  callDate?: Date | null; // call evals: the date of the call
  answers: EvalAnswerInput[];
  photoAssetIds: string[];
}

/** Score + persist an evaluation (Pending). Snapshots criteria/type/weight/value. */
export async function createEvaluation(input: CreateEvalInput, evaluatorUserId: number) {
  const config = await getCsConfig();
  const map = input.scope === "CALL" ? config.call : config.performance;
  const questions = await prisma.csQuestion.findMany({
    where: { id: { in: input.answers.map((a) => a.questionId) } },
    include: { type: { select: { name: true } } },
  });
  const qById = new Map(questions.map((q) => [q.id, q]));

  const rows = input.answers.flatMap((a) => {
    const q = qById.get(a.questionId);
    if (!q) return [];
    const value = valueFor(map, a.level);
    return [{
      questionId: q.id,
      title: q.title,
      criteria: q.criteria,
      typeName: q.type.name,
      weight: q.weight,
      level: a.level,
      value,
      weighted: value * q.weight,
      note: a.note?.trim() || null,
    }];
  });

  const scored = rows.map((r) => ({ weight: r.weight, value: r.value }));
  const uid = await nextUid("CSE");

  return prisma.csEvaluation.create({
    data: {
      uid,
      subjectUserId: input.subjectUserId,
      evaluatorUserId,
      scope: input.scope,
      typeName: input.typeName ?? null,
      callDate: input.callDate ?? null,
      status: "PENDING",
      total: weightedTotal(scored),
      normalized: normalizedPct(scored, map),
      answers: { create: rows },
      photos: input.photoAssetIds.length ? { create: input.photoAssetIds.map((assetId) => ({ assetId })) } : undefined,
    },
  });
}
