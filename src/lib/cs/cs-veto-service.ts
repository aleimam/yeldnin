import "server-only";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { getCsConfig } from "./cs-config-service";
import { vetoQuota, type VetoQuota } from "./cs-veto-logic";
import { getLocale } from "@/i18n/server";
import { makeT, isLocale, DEFAULT_LOCALE } from "@/i18n";
import { displayName } from "@/lib/users/users-logic";
import { sendCustomNotification } from "@/lib/notify/notify-message-service";
import { moduleOperatorIds } from "@/lib/notify/notify-service";

/** UTC [start, nextStart) for the calendar month containing `now`. */
function currentMonthRange(now: Date): { gte: Date; lt: Date } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  return { gte: new Date(Date.UTC(y, m, 1)), lt: new Date(Date.UTC(y, m + 1, 1)) };
}

export async function getVetoAllowance(): Promise<number> {
  return (await getCsConfig()).vetoAllowance;
}

/** A rep's veto quota for the current month (cast vetoes count regardless of outcome). */
export async function myVetoQuota(userId: number, now: Date = new Date()): Promise<VetoQuota> {
  const range = currentMonthRange(now);
  const [allowance, used] = await Promise.all([
    getVetoAllowance(),
    prisma.csVeto.count({ where: { byUserId: userId, createdAt: { gte: range.gte, lt: range.lt } } }),
  ]);
  return vetoQuota(allowance, used);
}

/** Which of these evaluation ids already have a veto → its status (for badges / disabling). */
export async function vetoStatusByEval(evalIds: number[]): Promise<Map<number, string>> {
  if (!evalIds.length) return new Map();
  const rows = await prisma.csVeto.findMany({ where: { evaluationId: { in: evalIds } }, select: { evaluationId: true, status: true } });
  return new Map(rows.map((r) => [r.evaluationId, r.status]));
}

/** Notify the CS approvers (cs_quality MANAGE + admins) that a veto was cast. */
async function notifyVetoCast(veto: { id: number; evaluationId: number; evalUid: string | null }, actorId: number) {
  const recipients = (await moduleOperatorIds(["cs_quality"], "MANAGE")).filter((u) => u !== actorId);
  if (!recipients.length) return;
  const users = await prisma.user.findMany({ where: { id: { in: recipients } }, select: { id: true, locale: true } });
  const ref = veto.evalUid ?? `#${veto.evaluationId}`;
  await Promise.allSettled(
    users.map((u) => {
      const tt = makeT(isLocale(u.locale) ? u.locale : DEFAULT_LOCALE);
      return sendCustomNotification(
        { title: tt("cs.veto.notif.castTitle"), body: tt("cs.veto.notif.castBody", { ref }), link: "/cs-quality/vetoes", type: "warning", target: { userIds: [u.id] } },
        actorId,
      );
    }),
  );
}

/** Notify the rep that their veto was kept (rejected) or upheld (deleted). */
async function notifyVetoResolved(veto: { evaluationId: number; evalUid: string | null; byUserId: number }, upheld: boolean, actorId: number) {
  const u = await prisma.user.findUnique({ where: { id: veto.byUserId }, select: { id: true, locale: true } });
  if (!u) return;
  const tt = makeT(isLocale(u.locale) ? u.locale : DEFAULT_LOCALE);
  const ref = veto.evalUid ?? `#${veto.evaluationId}`;
  await sendCustomNotification(
    {
      title: tt(upheld ? "cs.veto.notif.upheldTitle" : "cs.veto.notif.rejectedTitle"),
      body: tt(upheld ? "cs.veto.notif.upheldBody" : "cs.veto.notif.rejectedBody", { ref }),
      link: "/cs-quality/mine",
      type: upheld ? "success" : "info",
      target: { userIds: [u.id] },
    },
    actorId,
  ).catch(() => {});
}

/** Cast a veto on an APPROVED evaluation of oneself. Validates subject / status /
 *  no-existing-veto / monthly quota / note. Throws on any failure. */
export async function castVeto(evaluationId: number, userId: number, note: string): Promise<{ id: number }> {
  const trimmed = note.trim();
  if (!trimmed) throw new Error("A note is required to veto.");
  const ev = await prisma.csEvaluation.findFirst({
    where: { id: evaluationId, archivedAt: null },
    select: { id: true, uid: true, subjectUserId: true, status: true },
  });
  if (!ev) throw new Error("Evaluation not found.");
  if (ev.subjectUserId !== userId) throw new Error("You can only veto evaluations of yourself.");
  if (ev.status !== "APPROVED") throw new Error("Only approved evaluations can be vetoed.");
  const existing = await prisma.csVeto.findUnique({ where: { evaluationId }, select: { id: true } });
  if (existing) throw new Error("This evaluation has already been vetoed.");
  const quota = await myVetoQuota(userId);
  if (quota.remaining <= 0) throw new Error("You have no vetoes left this month.");

  const veto = await prisma.csVeto.create({ data: { evaluationId, byUserId: userId, note: trimmed }, select: { id: true } });
  await writeAudit(userId, "cs_quality", "veto.cast", "csVeto", veto.id, { evaluationId });
  await notifyVetoCast({ id: veto.id, evaluationId, evalUid: ev.uid }, userId).catch(() => {});
  return veto;
}

/** Admin resolves a pending veto: uphold (soft-delete the eval) or reject (keep it). */
export async function resolveVeto(vetoId: number, uphold: boolean, userId: number, note: string | null): Promise<boolean> {
  const veto = await prisma.csVeto.findUnique({
    where: { id: vetoId },
    select: { id: true, evaluationId: true, byUserId: true, status: true, evaluation: { select: { uid: true } } },
  });
  if (!veto || veto.status !== "PENDING") return false;
  await prisma.$transaction(async (tx) => {
    await tx.csVeto.update({
      where: { id: vetoId },
      data: { status: uphold ? "UPHELD" : "REJECTED", resolvedById: userId, resolvedAt: new Date(), resolutionNote: note?.trim() || null },
    });
    if (uphold) await tx.csEvaluation.update({ where: { id: veto.evaluationId }, data: { archivedAt: new Date() } });
  });
  await writeAudit(userId, "cs_quality", uphold ? "veto.uphold" : "veto.reject", "csVeto", vetoId, { evaluationId: veto.evaluationId });
  await notifyVetoResolved({ evaluationId: veto.evaluationId, evalUid: veto.evaluation.uid, byUserId: veto.byUserId }, uphold, userId).catch(() => {});
  return true;
}

export interface MyVetoRow {
  id: number;
  evaluationId: number;
  evalUid: string | null;
  scope: string;
  typeName: string | null;
  note: string;
  status: string;
  resolutionNote: string | null;
  createdAt: Date;
}

/** A rep's own vetoes (newest first) with the disputed eval's ref + result. */
export async function listMyVetoes(userId: number): Promise<MyVetoRow[]> {
  const rows = await prisma.csVeto.findMany({
    where: { byUserId: userId },
    orderBy: { createdAt: "desc" },
    include: { evaluation: { select: { uid: true, scope: true, typeName: true } } },
  });
  return rows.map((v) => ({
    id: v.id,
    evaluationId: v.evaluationId,
    evalUid: v.evaluation.uid,
    scope: v.evaluation.scope,
    typeName: v.evaluation.typeName,
    note: v.note,
    status: v.status,
    resolutionNote: v.resolutionNote,
    createdAt: v.createdAt,
  }));
}

export interface PendingVetoRow {
  id: number;
  evaluationId: number;
  evalUid: string | null;
  scope: string;
  typeName: string | null;
  rep: string;
  note: string;
  createdAt: Date;
}

/** Admin queue: pending vetoes with the disputed eval + the rep + their note. */
export async function listPendingVetoes(): Promise<PendingVetoRow[]> {
  const rows = await prisma.csVeto.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: { evaluation: { select: { uid: true, scope: true, typeName: true } } },
  });
  const [locale, users] = await Promise.all([
    getLocale(),
    prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.byUserId))] } }, select: { id: true, name: true, nameAr: true, uid: true } }),
  ]);
  const nameOf = new Map(users.map((u) => [u.id, u.uid ? `${displayName(u, locale)} (${u.uid})` : displayName(u, locale)]));
  return rows.map((v) => ({
    id: v.id,
    evaluationId: v.evaluationId,
    evalUid: v.evaluation.uid,
    scope: v.evaluation.scope,
    typeName: v.evaluation.typeName,
    rep: nameOf.get(v.byUserId) ?? `#${v.byUserId}`,
    note: v.note,
    createdAt: v.createdAt,
  }));
}

/** Count of pending vetoes (for an admin badge). */
export function pendingVetoCount(): Promise<number> {
  return prisma.csVeto.count({ where: { status: "PENDING" } });
}
