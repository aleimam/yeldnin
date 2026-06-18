"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireUser } from "@/lib/auth/access";
import { writeAudit } from "@/lib/audit";
import { saveCsConfig } from "@/lib/cs/cs-config-service";
import { saveCsTypeBatch, type CsTypeRow } from "@/lib/cs/cs-types-service";
import { createCsQuestion, updateCsQuestion, archiveCsQuestion, type CsQuestionInput } from "@/lib/cs/cs-question-service";
import { createEvaluation } from "@/lib/cs/cs-eval-service";
import { canEvaluateCalls, canManageCs, isCsLevel, type CsConfigShape } from "@/lib/cs/cs-logic";

export type QResult = { ok: true; id?: number } | { ok: false; error: string };

export async function saveCsConfigAction(config: CsConfigShape): Promise<{ ok: boolean }> {
  const access = await requireAdmin();
  await saveCsConfig(config, access.user.id);
  revalidatePath("/cs-quality/values");
  return { ok: true };
}

export async function saveCsTypesAction(scope: string, rows: CsTypeRow[], add: { name: string } | null): Promise<{ ok: boolean }> {
  const access = await requireAdmin();
  await saveCsTypeBatch(scope, rows, add, access.user.id);
  revalidatePath("/cs-quality/types");
  return { ok: true };
}

function validateQuestion(p: CsQuestionInput): string | null {
  if (!p.criteria.trim()) return "Criteria is required.";
  if (!p.typeId) return "Pick a type.";
  return null;
}

export async function createCsQuestionAction(p: CsQuestionInput): Promise<QResult> {
  const access = await requireAdmin();
  const err = validateQuestion(p);
  if (err) return { ok: false, error: err };
  const q = await createCsQuestion(p, access.user.id);
  revalidatePath("/cs-quality/questions");
  return { ok: true, id: q.id };
}

export async function updateCsQuestionAction(id: number, p: CsQuestionInput): Promise<QResult> {
  const access = await requireAdmin();
  const err = validateQuestion(p);
  if (err) return { ok: false, error: err };
  await updateCsQuestion(id, p, access.user.id);
  revalidatePath("/cs-quality/questions");
  return { ok: true };
}

export async function archiveCsQuestionAction(id: number): Promise<void> {
  const access = await requireAdmin();
  await archiveCsQuestion(id, access.user.id);
  revalidatePath("/cs-quality/questions");
}

export type EvalResult = { ok: true; id: number } | { ok: false; error: string };

export async function createCsEvaluationAction(p: {
  subjectUserId: number;
  scope: string;
  typeName?: string | null;
  answers: { questionId: number; level: string; note?: string }[];
  photoIds?: string[];
}): Promise<EvalResult> {
  const access = await requireUser();
  const allowed = p.scope === "CALL" ? canEvaluateCalls(access) : canManageCs(access);
  if (!allowed) return { ok: false, error: "You can't run that evaluation." };
  if (!p.subjectUserId) return { ok: false, error: "Pick a sales rep." };
  const answers = (p.answers ?? []).filter((a) => a.questionId && isCsLevel(a.level));
  if (!answers.length) return { ok: false, error: "Answer the questions." };
  const ev = await createEvaluation(
    { subjectUserId: p.subjectUserId, scope: p.scope, typeName: p.typeName ?? null, answers, photoAssetIds: p.photoIds ?? [] },
    access.user.id,
  );
  await writeAudit(access.user.id, "cs_quality", "eval.create", "csEvaluation", ev.id, { scope: p.scope });
  revalidatePath("/cs-quality/review");
  return { ok: true, id: ev.id };
}
