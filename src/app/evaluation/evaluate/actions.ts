"use server";
import { revalidatePath } from "next/cache";
import { requireModule } from "@/lib/auth/access";
import { myEmployeeId, saveEvaluation, setNotApplicable } from "@/lib/evaluation/eval-evaluate-service";

export interface SavePayload {
  evaluationId: number;
  subjectEmpId: number;
  overallComment: string;
  answers: { criterionId: number; level: number | null; note: string | null }[];
}

export async function saveEvaluationAction(payload: SavePayload): Promise<{ ok: boolean; error?: string }> {
  const access = await requireModule("evaluation", "VIEW");
  const empId = await myEmployeeId(access.user!.id);
  if (!empId) return { ok: false, error: "eval.err.noEmployee" };
  try {
    await saveEvaluation(payload.evaluationId, empId, { overallComment: payload.overallComment, answers: payload.answers });
    revalidatePath("/evaluation/evaluate");
    revalidatePath(`/evaluation/evaluate/${payload.subjectEmpId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "eval.err.notEditable" };
  }
}

export async function setNaAction(evaluationId: number, subjectEmpId: number, na: boolean): Promise<{ ok: boolean }> {
  const access = await requireModule("evaluation", "VIEW");
  const empId = await myEmployeeId(access.user!.id);
  if (!empId) return { ok: false };
  try {
    await setNotApplicable(evaluationId, empId, na);
    revalidatePath("/evaluation/evaluate");
    revalidatePath(`/evaluation/evaluate/${subjectEmpId}`);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
