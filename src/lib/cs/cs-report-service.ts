import "server-only";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { compositeOverall, type CompositeResult } from "./cs-logic";
import { getCsConfig } from "./cs-config-service";
import { getLocale } from "@/i18n/server";
import { makeT, isLocale, DEFAULT_LOCALE } from "@/i18n";
import { displayName } from "@/lib/users/users-logic";
import { sendCustomNotification } from "@/lib/notify/notify-message-service";

const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
// Call evals bucket by the call date; Performance by submission date.
const evalMonth = (e: { scope: string; callDate: Date | null; createdAt: Date }) =>
  monthKey(e.scope === "CALL" ? e.callDate ?? e.createdAt : e.createdAt);

/** Current CALL type English name → Arabic name, for localizing snapshot/
 *  analytics labels (which key off the English name). Empty when none set. */
export async function callTypeArNames(): Promise<Map<string, string>> {
  const types = await prisma.csEvalType.findMany({ where: { scope: "CALL", nameAr: { not: null } }, select: { name: true, nameAr: true } });
  return new Map(types.map((tp) => [tp.name, tp.nameAr as string]));
}

async function nameMap(ids: number[]): Promise<Map<number, string>> {
  if (!ids.length) return new Map();
  const [locale, u] = await Promise.all([
    getLocale(),
    prisma.user.findMany({ where: { id: { in: [...new Set(ids)] } }, select: { id: true, name: true, nameAr: true, uid: true } }),
  ]);
  return new Map(
    u.map((x) => {
      const dn = displayName(x, locale);
      return [x.id, x.uid ? `${dn} (${x.uid})` : dn];
    }),
  );
}

export interface EvalListRow {
  id: number;
  uid: string | null;
  subject: string;
  evaluator: string | null; // null when hidden (rep view)
  scope: string;
  typeName: string | null;
  channel: string | null; // call-only channel key (label via i18n)
  contact: string | null; // call-only customer name / phone
  status: string;
  total: number;
  normalized: number;
  date: Date; // effective date (call date for Call, submission for Performance)
}

/** Evaluations list (excludes archived). `showEvaluator` reveals the evaluator (hidden from reps). */
export async function listEvaluations(opts: { status?: string; subjectUserId?: number; evaluatorUserId?: number; showEvaluator: boolean; take?: number }): Promise<EvalListRow[]> {
  const evals = await prisma.csEvaluation.findMany({
    where: {
      archivedAt: null,
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.subjectUserId ? { subjectUserId: opts.subjectUserId } : {}),
      ...(opts.evaluatorUserId ? { evaluatorUserId: opts.evaluatorUserId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: opts.take ?? 300,
  });
  const [locale, names] = await Promise.all([
    getLocale(),
    nameMap(evals.flatMap((e) => [e.subjectUserId, e.evaluatorUserId])),
  ]);
  // The eval-level type label is an English snapshot; in Arabic, map it to the
  // current call type's Arabic name when one exists (best-effort by name).
  const typeArMap = locale === "ar" ? await callTypeArNames() : new Map<string, string>();
  return evals.map((e) => ({
    id: e.id,
    uid: e.uid,
    subject: names.get(e.subjectUserId) ?? `#${e.subjectUserId}`,
    evaluator: opts.showEvaluator ? names.get(e.evaluatorUserId) ?? `#${e.evaluatorUserId}` : null,
    scope: e.scope,
    typeName: e.typeName ? typeArMap.get(e.typeName) ?? e.typeName : null,
    channel: e.channel,
    contact: e.contact,
    status: e.status,
    total: e.total,
    normalized: e.normalized,
    date: e.scope === "CALL" ? e.callDate ?? e.createdAt : e.createdAt,
  }));
}

export async function getEvaluationDetail(id: number) {
  const ev = await prisma.csEvaluation.findFirst({ where: { id, archivedAt: null }, include: { answers: { orderBy: { id: "asc" } }, photos: true } });
  if (!ev) return null;
  const names = await nameMap([ev.subjectUserId, ev.evaluatorUserId, ...(ev.approvedById ? [ev.approvedById] : [])]);
  return {
    ev,
    subject: names.get(ev.subjectUserId) ?? `#${ev.subjectUserId}`,
    evaluator: names.get(ev.evaluatorUserId) ?? `#${ev.evaluatorUserId}`,
    approver: ev.approvedById ? names.get(ev.approvedById) ?? null : null,
  };
}

/** Notify the evaluated rep + the evaluator that an evaluation was approved,
 *  each in their own locale. Best-effort: never blocks the approval. */
async function notifyApproval(
  ev: { id: number; uid: string | null; subjectUserId: number; evaluatorUserId: number },
  approverId: number,
) {
  const link = `/cs-quality/evaluations/${ev.id}`;
  const ref = ev.uid ?? `#${ev.id}`;
  const users = await prisma.user.findMany({
    where: { id: { in: [ev.subjectUserId, ev.evaluatorUserId] } },
    select: { id: true, locale: true },
  });
  const tFor = (uid: number) => {
    const l = users.find((u) => u.id === uid)?.locale;
    return makeT(isLocale(l) ? l : DEFAULT_LOCALE);
  };
  const targets = [
    { userId: ev.subjectUserId, bodyKey: "cs.notif.approvedSubjectBody" },
    { userId: ev.evaluatorUserId, bodyKey: "cs.notif.approvedEvaluatorBody" },
  ];
  await Promise.allSettled(
    targets.map((tg) => {
      const tt = tFor(tg.userId);
      return sendCustomNotification(
        { title: tt("cs.notif.approvedTitle"), body: tt(tg.bodyKey, { ref }), link, type: "success", target: { userIds: [tg.userId] } },
        approverId,
      );
    }),
  );
}

export async function approveEvaluation(id: number, userId: number) {
  const ev = await prisma.csEvaluation.update({
    where: { id },
    data: { status: "APPROVED", approvedById: userId, approvedAt: new Date(), rejectedNote: null },
    select: { id: true, uid: true, subjectUserId: true, evaluatorUserId: true },
  });
  await writeAudit(userId, "cs_quality", "eval.approve", "csEvaluation", id, {});
  await notifyApproval(ev, userId).catch(() => {});
}
export async function rejectEvaluation(id: number, note: string | null, userId: number) {
  await prisma.csEvaluation.update({ where: { id }, data: { status: "REJECTED", rejectedNote: note?.trim() || null } });
  await writeAudit(userId, "cs_quality", "eval.reject", "csEvaluation", id, {});
}

/** Soft-delete: admins delete any; an evaluator deletes their own while Pending. */
export async function softDeleteEvaluation(id: number, userId: number, isAdmin: boolean): Promise<boolean> {
  const ev = await prisma.csEvaluation.findFirst({ where: { id, archivedAt: null }, select: { evaluatorUserId: true, status: true } });
  if (!ev) return false;
  if (!(isAdmin || (ev.evaluatorUserId === userId && ev.status === "PENDING"))) return false;
  await prisma.csEvaluation.update({ where: { id }, data: { archivedAt: new Date() } });
  await writeAudit(userId, "cs_quality", "eval.delete", "csEvaluation", id, {});
  return true;
}

// ── Analytics: monthly overall average (weighted composite) ─────────────────────

const monthKeyOf = (y: number, m0: number) => `${y}-${String(m0 + 1).padStart(2, "0")}`;
function prevMonthKey(now: Date): string {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  return m === 0 ? monthKeyOf(y - 1, 11) : monthKeyOf(y, m - 1);
}

type MonthEval = { scope: string; typeName: string | null; normalized: number; callDate: Date | null; createdAt: Date };

async function callTypeWeights(): Promise<{ name: string; weight: number }[]> {
  const ts = await prisma.csEvalType.findMany({ where: { scope: "CALL", archivedAt: null }, select: { name: true, weight: true } });
  return ts.map((t) => ({ name: t.name, weight: t.weight }));
}

/** The composite overall average for one month from a rep's approved evaluations. */
function compositeForMonth(evals: MonthEval[], monthK: string, callTypes: { name: string; weight: number }[], split: { calls: number; performance: number }): CompositeResult {
  const m = evals.filter((e) => evalMonth(e) === monthK);
  return compositeOverall({
    callTypes,
    callEvals: m.filter((e) => e.scope === "CALL").map((e) => ({ typeName: e.typeName, normalized: e.normalized })),
    perfEvals: m.filter((e) => e.scope === "PERFORMANCE").map((e) => ({ normalized: e.normalized })),
    callsWeight: split.calls,
    perfWeight: split.performance,
  });
}

export interface RepAnalytics {
  count: number; // total approved evals (all-time)
  current: CompositeResult; // this month-to-date
  previous: CompositeResult; // last month
  byMonth: { month: string; overall: number | null; count: number }[];
}

/** Approved-only monthly composite for one rep: this month + last month + history. */
export async function repAnalytics(subjectUserId: number, now: Date = new Date()): Promise<RepAnalytics> {
  const [evals, callTypes, cfg] = await Promise.all([
    prisma.csEvaluation.findMany({ where: { subjectUserId, status: "APPROVED", archivedAt: null }, select: { scope: true, typeName: true, normalized: true, callDate: true, createdAt: true } }),
    callTypeWeights(),
    getCsConfig(),
  ]);
  const counts = new Map<string, number>();
  for (const e of evals) counts.set(evalMonth(e), (counts.get(evalMonth(e)) ?? 0) + 1);
  const byMonth = [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, count]) => ({ month, overall: compositeForMonth(evals, month, callTypes, cfg.split).overall, count }));
  return {
    count: evals.length,
    current: compositeForMonth(evals, monthKey(now), callTypes, cfg.split),
    previous: compositeForMonth(evals, prevMonthKey(now), callTypes, cfg.split),
    byMonth,
  };
}

export interface RepSummary {
  id: number;
  name: string;
  count: number; // total approved (all-time)
  current: number | null; // this month's overall average
  previous: number | null; // last month's overall average
}

/** Per-rep leaderboard: this-month & last-month composite overall average. */
export async function allRepsAnalytics(now: Date): Promise<RepSummary[]> {
  const [evals, callTypes, cfg] = await Promise.all([
    prisma.csEvaluation.findMany({ where: { status: "APPROVED", archivedAt: null }, select: { subjectUserId: true, scope: true, typeName: true, normalized: true, callDate: true, createdAt: true } }),
    callTypeWeights(),
    getCsConfig(),
  ]);
  const curK = monthKey(now);
  const prevK = prevMonthKey(now);
  const bySubject = new Map<number, MonthEval[]>();
  for (const e of evals) {
    const arr = bySubject.get(e.subjectUserId) ?? [];
    arr.push(e);
    bySubject.set(e.subjectUserId, arr);
  }
  const names = await nameMap([...bySubject.keys()]);
  return [...bySubject.entries()]
    .map(([id, list]) => ({
      id,
      name: names.get(id) ?? `#${id}`,
      count: list.length,
      current: compositeForMonth(list, curK, callTypes, cfg.split).overall,
      previous: compositeForMonth(list, prevK, callTypes, cfg.split).overall,
    }))
    .sort((a, b) => (b.current ?? -Infinity) - (a.current ?? -Infinity));
}
