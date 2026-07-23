import "server-only";
import { prisma } from "@/lib/db";
import { sendLocalizedCustomNotification } from "@/lib/notify/notify-message-service";

export interface FeedbackRow {
  subjectEmpId: number;
  name: string;
  nameAr: string | null;
  status: string; // NOT_GENERATED | GENERATING | GENERATED | RELEASED | FAILED
  hasPeerData: boolean;
  effortCoveragePct: number | null;
  effortDepth: number | null;
  effortScore: number | null;
  error: string | null;
}

/** The feedback queue for a cycle: every participant + their generation status. */
export async function feedbackQueue(cycleId: number): Promise<FeedbackRow[]> {
  const [fbs, overalls] = await Promise.all([
    prisma.evalFeedback.findMany({ where: { cycleId } }),
    prisma.evalResult.findMany({ where: { cycleId, scope: "OVERALL" }, select: { subjectEmpId: true } }),
  ]);
  const hasData = new Set(overalls.map((o) => o.subjectEmpId));
  const ids = fbs.map((f) => f.subjectEmpId);
  const emps = ids.length ? await prisma.employee.findMany({ where: { id: { in: ids } }, select: { id: true, user: { select: { name: true, nameAr: true } } } }) : [];
  const nById = new Map(emps.map((e) => [e.id, e.user]));
  return fbs
    .map((f) => ({
      subjectEmpId: f.subjectEmpId,
      name: nById.get(f.subjectEmpId)?.name ?? `#${f.subjectEmpId}`,
      nameAr: nById.get(f.subjectEmpId)?.nameAr ?? null,
      status: f.status,
      hasPeerData: hasData.has(f.subjectEmpId),
      effortCoveragePct: f.effortCoverage != null ? Math.round(f.effortCoverage * 100) : null,
      effortDepth: f.effortDepth,
      effortScore: f.effortScore,
      error: f.error,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface FeedbackDetail {
  subjectEmpId: number;
  name: string;
  nameAr: string | null;
  status: string;
  draftMd: string | null;
  editedMd: string | null;
  adminNote: string | null;
  effortCoveragePct: number | null;
  effortDepth: number | null;
  effortScore: number | null;
}

export async function getFeedback(cycleId: number, subjectEmpId: number): Promise<FeedbackDetail | null> {
  const [fb, emp] = await Promise.all([
    prisma.evalFeedback.findUnique({ where: { cycleId_subjectEmpId: { cycleId, subjectEmpId } } }),
    prisma.employee.findUnique({ where: { id: subjectEmpId }, select: { user: { select: { name: true, nameAr: true } } } }),
  ]);
  if (!fb) return null;
  return {
    subjectEmpId,
    name: emp?.user.name ?? `#${subjectEmpId}`,
    nameAr: emp?.user.nameAr ?? null,
    status: fb.status,
    draftMd: fb.draftMd,
    editedMd: fb.editedMd,
    adminNote: fb.adminNote,
    effortCoveragePct: fb.effortCoverage != null ? Math.round(fb.effortCoverage * 100) : null,
    effortDepth: fb.effortDepth,
    effortScore: fb.effortScore,
  };
}

export async function saveDraft(cycleId: number, subjectEmpId: number, editedMd: string): Promise<void> {
  await prisma.evalFeedback.update({ where: { cycleId_subjectEmpId: { cycleId, subjectEmpId } }, data: { editedMd: editedMd.trim() || null } });
}

export async function saveAdminNote(cycleId: number, subjectEmpId: number, note: string): Promise<void> {
  await prisma.evalFeedback.update({ where: { cycleId_subjectEmpId: { cycleId, subjectEmpId } }, data: { adminNote: note.trim() || null } });
}

export async function overrideEffort(cycleId: number, subjectEmpId: number, effortScore: number | null): Promise<void> {
  const v = effortScore == null ? null : Math.max(0, Math.min(100, Math.round(effortScore)));
  await prisma.evalFeedback.update({ where: { cycleId_subjectEmpId: { cycleId, subjectEmpId } }, data: { effortScore: v } });
}

/** Release one report to the employee + notify them. Only GENERATED/RELEASED. */
export async function releaseFeedback(cycleId: number, subjectEmpId: number, actorId: number): Promise<void> {
  const fb = await prisma.evalFeedback.findUnique({ where: { cycleId_subjectEmpId: { cycleId, subjectEmpId } }, select: { status: true } });
  if (!fb || (fb.status !== "GENERATED" && fb.status !== "RELEASED")) return;
  await prisma.evalFeedback.update({ where: { cycleId_subjectEmpId: { cycleId, subjectEmpId } }, data: { status: "RELEASED", releasedAt: new Date() } });
  const emp = await prisma.employee.findUnique({ where: { id: subjectEmpId }, select: { userId: true } });
  if (emp) {
    const cycle = await prisma.evalCycle.findUnique({ where: { id: cycleId }, select: { name: true } });
    await sendLocalizedCustomNotification([emp.userId], "eval.notif.reportTitle", "eval.notif.reportBody", { name: cycle?.name ?? "" }, "/evaluation/results", "success", actorId).catch(() => {});
  }
}

/** Release every generated (not-yet-released) report in the cycle. */
export async function releaseAll(cycleId: number, actorId: number): Promise<number> {
  const pending = await prisma.evalFeedback.findMany({ where: { cycleId, status: "GENERATED" }, select: { subjectEmpId: true } });
  for (const p of pending) await releaseFeedback(cycleId, p.subjectEmpId, actorId);
  return pending.length;
}
