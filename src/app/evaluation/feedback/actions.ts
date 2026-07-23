"use server";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth/access";
import { writeAudit } from "@/lib/audit";
import { generateBatch } from "@/lib/evaluation/eval-ai-service";
import { saveDraft, saveAdminNote, overrideEffort, releaseFeedback, releaseAll } from "@/lib/evaluation/eval-feedback-service";

const RV = () => revalidatePath(`/evaluation/feedback`);

/** Kick off the whole-cycle AI batch (fire-and-forget on this persistent server).
 *  The page only shows this when the AI key is configured. */
export async function generateBatchAction(fd: FormData): Promise<void> {
  const access = await requireCapability("evaluation", "manage");
  const cycleId = Number(fd.get("cycleId"));
  if (!cycleId) return;
  void generateBatch(cycleId).catch(() => {});
  await writeAudit(access.user.id, "evaluation", "feedback.generate", "evalCycle", cycleId);
  RV();
}

export async function regenerateOneAction(fd: FormData): Promise<void> {
  await requireCapability("evaluation", "manage");
  const cycleId = Number(fd.get("cycleId"));
  const empId = Number(fd.get("empId"));
  if (!cycleId || !empId) return;
  void generateBatch(cycleId, { onlyEmpId: empId }).catch(() => {});
  RV();
}

export async function saveDraftAction(fd: FormData): Promise<void> {
  await requireCapability("evaluation", "manage");
  const cycleId = Number(fd.get("cycleId"));
  const empId = Number(fd.get("empId"));
  if (!cycleId || !empId) return;
  await saveDraft(cycleId, empId, String(fd.get("editedMd") ?? ""));
  RV();
}

export async function saveAdminNoteAction(fd: FormData): Promise<void> {
  await requireCapability("evaluation", "manage");
  const cycleId = Number(fd.get("cycleId"));
  const empId = Number(fd.get("empId"));
  if (!cycleId || !empId) return;
  await saveAdminNote(cycleId, empId, String(fd.get("adminNote") ?? ""));
  RV();
}

export async function overrideEffortAction(fd: FormData): Promise<void> {
  await requireCapability("evaluation", "manage");
  const cycleId = Number(fd.get("cycleId"));
  const empId = Number(fd.get("empId"));
  const raw = String(fd.get("effortScore") ?? "").trim();
  if (!cycleId || !empId) return;
  await overrideEffort(cycleId, empId, raw === "" ? null : Number(raw));
  RV();
}

export async function releaseAction(fd: FormData): Promise<void> {
  const access = await requireCapability("evaluation", "manage");
  const cycleId = Number(fd.get("cycleId"));
  const empId = Number(fd.get("empId"));
  if (!cycleId || !empId) return;
  await releaseFeedback(cycleId, empId, access.user.id);
  await writeAudit(access.user.id, "evaluation", "feedback.release", "evalCycle", cycleId, { emp: empId });
  RV();
}

export async function releaseAllAction(fd: FormData): Promise<void> {
  const access = await requireCapability("evaluation", "manage");
  const cycleId = Number(fd.get("cycleId"));
  if (!cycleId) return;
  const n = await releaseAll(cycleId, access.user.id);
  await writeAudit(access.user.id, "evaluation", "feedback.releaseAll", "evalCycle", cycleId, { count: n });
  RV();
}
