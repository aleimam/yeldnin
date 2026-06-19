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

export interface UpdateEvalInput {
  subjectUserId: number;
  typeName?: string | null;
  callDate?: Date | null;
  channel?: string | null;
  contact?: string | null;
  answers: EvalAnswerInput[];
  photoAssetIds: string[];
}

/** Re-score + persist edits to an existing evaluation (replacing its answers +
 *  photos). A rejected evaluation is resubmitted (→ Pending, note cleared); other
 *  statuses are kept. The scope/creator are immutable. */
export async function updateEvaluation(id: number, input: UpdateEvalInput) {
  const ev = await prisma.csEvaluation.findFirst({ where: { id, archivedAt: null }, select: { scope: true, status: true } });
  if (!ev) throw new Error("Evaluation not found.");
  const config = await getCsConfig();
  const map = ev.scope === "CALL" ? config.call : config.performance;
  const questions = await prisma.csQuestion.findMany({
    where: { id: { in: input.answers.map((a) => a.questionId) }, scope: ev.scope, active: true, archivedAt: null },
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

  await prisma.$transaction([
    prisma.csEvaluationAnswer.deleteMany({ where: { evaluationId: id } }),
    prisma.csEvaluationPhoto.deleteMany({ where: { evaluationId: id } }),
    prisma.csEvaluation.update({
      where: { id },
      data: {
        subjectUserId: input.subjectUserId,
        typeName: input.typeName ?? null,
        callDate: input.callDate ?? null,
        channel: input.channel ?? null,
        contact: input.contact ?? null,
        total: weightedTotal(scored),
        normalized: normalizedPct(scored, map),
        // Any edit returns the evaluation to the review queue for re-approval.
        status: "PENDING",
        rejectedNote: null,
        approvedById: null,
        approvedAt: null,
        answers: { create: rows },
        photos: input.photoAssetIds.length ? { create: input.photoAssetIds.map((assetId) => ({ assetId })) } : undefined,
      },
    }),
  ]);
  return { id, scope: ev.scope };
}

/** Minimal record for the edit/delete permission check + scope context. */
export function getEvaluationGuard(id: number) {
  return prisma.csEvaluation.findFirst({ where: { id, archivedAt: null }, select: { evaluatorUserId: true, createdAt: true, scope: true } });
}

/** Lightweight fetch for the edit page: the eval + its answers (level/note/qid)
 *  + photo asset ids, to pre-fill the form. */
export async function getEvaluationForEdit(id: number) {
  return prisma.csEvaluation.findFirst({
    where: { id, archivedAt: null },
    include: {
      answers: { select: { questionId: true, level: true, note: true } },
      photos: { select: { assetId: true } },
    },
  });
}
