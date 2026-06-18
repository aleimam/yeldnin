"use server";
import { revalidatePath } from "next/cache";
import { getT } from "@/i18n/server";
import { requireCapability, requireUser } from "@/lib/auth/access";
import { writeAudit } from "@/lib/audit";
import { saveCsConfig } from "@/lib/cs/cs-config-service";
import { saveCsTypeBatch, type CsTypeRow } from "@/lib/cs/cs-types-service";
import { saveRepBonuses, saveBonusTiers } from "@/lib/cs/cs-bonus-service";
import type { BonusTier } from "@/lib/cs/cs-logic";
import { createCsQuestion, updateCsQuestion, archiveCsQuestion, type CsQuestionInput } from "@/lib/cs/cs-question-service";
import { createEvaluation } from "@/lib/cs/cs-eval-service";
import { approveEvaluation, rejectEvaluation, softDeleteEvaluation } from "@/lib/cs/cs-report-service";
import { canEvaluateCalls, canManageCs, isCsLevel, type CsConfigShape } from "@/lib/cs/cs-logic";

export type QResult = { ok: true; id?: number } | { ok: false; error: string };

export async function saveCsConfigAction(config: CsConfigShape): Promise<{ ok: boolean }> {
  const access = await requireCapability("cs_quality", "manage");
  await saveCsConfig(config, access.user.id);
  revalidatePath("/cs-quality/values");
  return { ok: true };
}

export async function saveCsTypesAction(scope: string, rows: CsTypeRow[], add: { name: string; nameAr?: string | null; weight?: number } | null): Promise<{ ok: boolean }> {
  const access = await requireCapability("cs_quality", "manage");
  await saveCsTypeBatch(scope, rows, add, access.user.id);
  revalidatePath("/cs-quality/types");
  return { ok: true };
}

export async function saveRepBonusesAction(rows: { userId: number; maxBonus: number }[]): Promise<{ ok: boolean }> {
  const access = await requireCapability("cs_quality", "manage");
  await saveRepBonuses(rows, access.user.id);
  revalidatePath("/cs-quality/bonus");
  return { ok: true };
}

export async function saveBonusTiersAction(tiers: BonusTier[]): Promise<{ ok: boolean }> {
  const access = await requireCapability("cs_quality", "manage");
  await saveBonusTiers(tiers, access.user.id);
  revalidatePath("/cs-quality/bonus");
  return { ok: true };
}

/** Returns an i18n key for the first failing rule, or null when valid. */
function validateQuestion(p: CsQuestionInput): string | null {
  if (!p.title.trim()) return "cs.err.titleRequired";
  if (!p.criteria.trim()) return "cs.err.questionRequired";
  if (!p.typeId) return "cs.err.pickType";
  return null;
}

export async function createCsQuestionAction(p: CsQuestionInput): Promise<QResult> {
  const access = await requireCapability("cs_quality", "manage");
  const err = validateQuestion(p);
  if (err) return { ok: false, error: (await getT())(err) };
  const q = await createCsQuestion(p, access.user.id);
  revalidatePath("/cs-quality/questions");
  return { ok: true, id: q.id };
}

export async function updateCsQuestionAction(id: number, p: CsQuestionInput): Promise<QResult> {
  const access = await requireCapability("cs_quality", "manage");
  const err = validateQuestion(p);
  if (err) return { ok: false, error: (await getT())(err) };
  await updateCsQuestion(id, p, access.user.id);
  revalidatePath("/cs-quality/questions");
  return { ok: true };
}

export async function archiveCsQuestionAction(id: number): Promise<void> {
  const access = await requireCapability("cs_quality", "manage");
  await archiveCsQuestion(id, access.user.id);
  revalidatePath("/cs-quality/questions");
}

export type EvalResult = { ok: true; id: number } | { ok: false; error: string };

export async function createCsEvaluationAction(p: {
  subjectUserId: number;
  scope: string;
  typeName?: string | null;
  callDate?: string | null;
  answers: { questionId: number; level: string; note?: string }[];
  photoIds?: string[];
}): Promise<EvalResult> {
  const access = await requireUser();
  const t = await getT();
  const allowed = p.scope === "CALL" ? canEvaluateCalls(access) : canManageCs(access);
  if (!allowed) return { ok: false, error: t("cs.err.cantEvaluate") };
  if (!p.subjectUserId) return { ok: false, error: t("cs.pickRep") };
  if (p.subjectUserId === access.user.id) return { ok: false, error: t("cs.err.cantEvaluateSelf") };
  if (!p.callDate) return { ok: false, error: t("cs.pickDate") };
  const answers = (p.answers ?? []).filter((a) => a.questionId && isCsLevel(a.level));
  if (!answers.length) return { ok: false, error: t("cs.answerAll") };
  const ev = await createEvaluation(
    {
      subjectUserId: p.subjectUserId,
      scope: p.scope,
      typeName: p.typeName ?? null,
      callDate: p.callDate ? new Date(p.callDate) : null,
      answers,
      photoAssetIds: p.photoIds ?? [],
    },
    access.user.id,
  );
  await writeAudit(access.user.id, "cs_quality", "eval.create", "csEvaluation", ev.id, { scope: p.scope });
  revalidatePath("/cs-quality/review");
  return { ok: true, id: ev.id };
}

export async function deleteCsEvaluationAction(id: number): Promise<void> {
  const access = await requireUser();
  await softDeleteEvaluation(id, access.user.id, canManageCs(access));
  revalidatePath("/cs-quality/review");
  revalidatePath("/cs-quality/submitted");
  revalidatePath("/cs-quality/mine");
}

export async function approveCsEvaluationAction(id: number): Promise<void> {
  const access = await requireCapability("cs_quality", "manage");
  await approveEvaluation(id, access.user.id);
  revalidatePath("/cs-quality/review");
  revalidatePath(`/cs-quality/evaluations/${id}`);
}

export async function rejectCsEvaluationAction(id: number, note: string): Promise<void> {
  const access = await requireCapability("cs_quality", "manage");
  await rejectEvaluation(id, note || null, access.user.id);
  revalidatePath("/cs-quality/review");
  revalidatePath(`/cs-quality/evaluations/${id}`);
}
