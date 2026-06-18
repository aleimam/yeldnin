"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/access";
import { saveCsConfig } from "@/lib/cs/cs-config-service";
import { saveCsTypeBatch, type CsTypeRow } from "@/lib/cs/cs-types-service";
import { createCsQuestion, updateCsQuestion, archiveCsQuestion, type CsQuestionInput } from "@/lib/cs/cs-question-service";
import type { CsConfigShape } from "@/lib/cs/cs-logic";

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
