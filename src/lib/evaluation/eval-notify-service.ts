import "server-only";
import { prisma } from "@/lib/db";
import { sendLocalizedCustomNotification } from "@/lib/notify/notify-message-service";
import { adminUserIds } from "@/lib/notify/notify-service";
import { formatBizDate } from "@/lib/format/dates";
import { reminderDueToday, alreadyRemindedToday } from "./eval-reminder-logic";

/** Active user ids for a cycle's frozen participants. */
async function participantUserIds(cycleId: number): Promise<number[]> {
  const parts = await prisma.evalCycleParticipant.findMany({ where: { cycleId }, select: { empId: true } });
  if (!parts.length) return [];
  const emps = await prisma.employee.findMany({ where: { id: { in: parts.map((p) => p.empId) }, archivedAt: null }, select: { userId: true } });
  return emps.map((e) => e.userId);
}

/** Best-effort: tell every participant a review cycle just opened. */
export async function notifyCycleOpen(cycleId: number): Promise<void> {
  const cycle = await prisma.evalCycle.findUnique({ where: { id: cycleId }, select: { name: true, deadline: true, status: true } });
  if (!cycle || cycle.status !== "OPEN") return;
  const users = await participantUserIds(cycleId);
  await sendLocalizedCustomNotification(
    users,
    "eval.notif.openTitle",
    "eval.notif.openBody",
    { name: cycle.name, deadline: formatBizDate(cycle.deadline) },
    "/evaluation/evaluate",
    "info",
    0,
  ).catch(() => {});
}

/** Best-effort: tell participants a cycle closed and results are ready. */
export async function notifyCycleClosed(cycleId: number): Promise<void> {
  const cycle = await prisma.evalCycle.findUnique({ where: { id: cycleId }, select: { name: true } });
  if (!cycle) return;
  const users = await participantUserIds(cycleId);
  await sendLocalizedCustomNotification(
    users,
    "eval.notif.closedTitle",
    "eval.notif.closedBody",
    { name: cycle.name },
    "/evaluation/results",
    "success",
    0,
  ).catch(() => {});
}

/**
 * Daily sweep for the single open cycle: remind still-incomplete participants per
 * the fixed cadence, and tell admins once when everyone is done. `lastReminderAt`
 * / `completeNotifiedAt` dedup so a double cron hit never double-notifies.
 */
export async function runCycleReminders(now: Date = new Date()): Promise<{ cycleId: number | null; reminded: number; completeNotified: boolean }> {
  const cycle = await prisma.evalCycle.findFirst({ where: { status: "OPEN" }, orderBy: { id: "desc" } });
  if (!cycle) return { cycleId: null, reminded: 0, completeNotified: false };

  const evals = await prisma.evaluation.findMany({ where: { cycleId: cycle.id }, select: { evaluatorEmpId: true, status: true } });
  const incomplete = new Set<number>();
  const everyone = new Set<number>();
  for (const e of evals) {
    everyone.add(e.evaluatorEmpId);
    if (e.status === "PENDING") incomplete.add(e.evaluatorEmpId);
  }

  // Fully complete → tell admins once.
  let completeNotified = false;
  if (incomplete.size === 0 && everyone.size > 0 && !cycle.completeNotifiedAt) {
    const admins = await adminUserIds();
    await sendLocalizedCustomNotification(admins, "eval.notif.completeTitle", "eval.notif.completeBody", { name: cycle.name }, `/evaluation/cycles/${cycle.id}`, "success", 0).catch(() => {});
    await prisma.evalCycle.update({ where: { id: cycle.id }, data: { completeNotifiedAt: now } });
    completeNotified = true;
  }

  // Reminder cadence to the incomplete.
  let reminded = 0;
  if (incomplete.size > 0 && reminderDueToday(cycle.startedAt, cycle.deadline, now) && !alreadyRemindedToday(cycle.lastReminderAt, now)) {
    const emps = await prisma.employee.findMany({ where: { id: { in: [...incomplete] }, archivedAt: null }, select: { userId: true } });
    const users = emps.map((e) => e.userId);
    await sendLocalizedCustomNotification(
      users,
      "eval.notif.remindTitle",
      "eval.notif.remindBody",
      { name: cycle.name, deadline: formatBizDate(cycle.deadline) },
      "/evaluation/evaluate",
      "warning",
      0,
    ).catch(() => {});
    await prisma.evalCycle.update({ where: { id: cycle.id }, data: { lastReminderAt: now } });
    reminded = users.length;
  }

  return { cycleId: cycle.id, reminded, completeNotified };
}
