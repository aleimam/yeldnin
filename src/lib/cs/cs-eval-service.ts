import "server-only";
import { prisma } from "@/lib/db";
import { nextUid } from "@/lib/uid";
import { getCsConfig } from "./cs-config-service";
import { valueFor, weightedTotal, normalizedPct, SALES_TEAM_KEY } from "./cs-logic";
import { getLocale } from "@/i18n/server";
import { displayName } from "@/lib/users/users-logic";

/** The evaluated population = active members of the Sales team (pharmacists). */
export async function listRepOptions(excludeUserId?: number): Promise<{ id: number; name: string }[]> {
  const [locale, users] = await Promise.all([
    getLocale(),
    prisma.user.findMany({
      where: {
        active: true,
        archivedAt: null,
        ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
        teamMembers: { some: { team: { key: SALES_TEAM_KEY } } },
      },
      select: { id: true, name: true, nameAr: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return users.map((u) => ({ id: u.id, name: displayName(u, locale) }));
}

/** Active questions for a scope (Call filtered by type; Periodical = all). */
export async function questionsForScope(scope: string, typeId?: number) {
  return prisma.csQuestion.findMany({
    where: { archivedAt: null, active: true, scope, type: { archivedAt: null }, ...(typeId ? { typeId } : {}) },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: { type: { select: { id: true, name: true, nameAr: true } } },
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
  channel?: string | null; // call evals: contact channel key
  contact?: string | null; // call evals: customer name / phone
  answers: EvalAnswerInput[];
  photoAssetIds: string[];
}

/** Score + persist an evaluation (Pending). Snapshots criteria/type/weight/value. */
export async function createEvaluation(input: CreateEvalInput, evaluatorUserId: number) {
  const config = await getCsConfig();
  const map = input.scope === "CALL" ? config.call : config.performance;
  // Re-fetch under the submitted scope so a stale/tampered client can't score
  // cross-scope, archived, or inactive questions; unmatched answers drop below.
  const questions = await prisma.csQuestion.findMany({
    where: { id: { in: input.answers.map((a) => a.questionId) }, scope: input.scope, active: true, archivedAt: null },
    include: { type: { select: { name: true, nameAr: true } } },
  });
  const qById = new Map(questions.map((q) => [q.id, q]));

  const rows = input.answers.flatMap((a) => {
    const q = qById.get(a.questionId);
    if (!q) return [];
    const value = valueFor(map, a.level);
    return [{
      questionId: q.id,
      title: q.title,
      titleAr: q.titleAr,
      criteria: q.criteria,
      criteriaAr: q.criteriaAr,
      typeName: q.type.name,
      typeNameAr: q.type.nameAr,
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
      channel: input.channel ?? null,
      contact: input.contact ?? null,
      status: "PENDING",
      total: weightedTotal(scored),
      normalized: normalizedPct(scored, map),
      answers: { create: rows },
      photos: input.photoAssetIds.length ? { create: input.photoAssetIds.map((assetId) => ({ assetId })) } : undefined,
    },
  });
}
