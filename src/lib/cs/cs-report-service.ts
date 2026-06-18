import "server-only";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { round2, CS_SCOPES } from "./cs-logic";

const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
// Call evals bucket by the call date; Performance by submission date.
const evalMonth = (e: { scope: string; callDate: Date | null; createdAt: Date }) =>
  monthKey(e.scope === "CALL" ? e.callDate ?? e.createdAt : e.createdAt);

async function nameMap(ids: number[]): Promise<Map<number, string>> {
  if (!ids.length) return new Map();
  const u = await prisma.user.findMany({ where: { id: { in: [...new Set(ids)] } }, select: { id: true, name: true, fullName: true, uid: true } });
  return new Map(u.map((x) => [x.id, x.uid ? `${x.fullName || x.name} (${x.uid})` : x.fullName || x.name]));
}

export interface EvalListRow {
  id: number;
  uid: string | null;
  subject: string;
  evaluator: string | null; // null when hidden (rep view)
  scope: string;
  typeName: string | null;
  status: string;
  total: number;
  normalized: number;
  date: Date; // effective date (call date for Call, submission for Performance)
}

/** Evaluations list (excludes archived). `showEvaluator` reveals the evaluator (hidden from reps). */
export async function listEvaluations(opts: { status?: string; subjectUserId?: number; evaluatorUserId?: number; showEvaluator: boolean }): Promise<EvalListRow[]> {
  const evals = await prisma.csEvaluation.findMany({
    where: {
      archivedAt: null,
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.subjectUserId ? { subjectUserId: opts.subjectUserId } : {}),
      ...(opts.evaluatorUserId ? { evaluatorUserId: opts.evaluatorUserId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  const names = await nameMap(evals.flatMap((e) => [e.subjectUserId, e.evaluatorUserId]));
  return evals.map((e) => ({
    id: e.id,
    uid: e.uid,
    subject: names.get(e.subjectUserId) ?? `#${e.subjectUserId}`,
    evaluator: opts.showEvaluator ? names.get(e.evaluatorUserId) ?? `#${e.evaluatorUserId}` : null,
    scope: e.scope,
    typeName: e.typeName,
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

export async function approveEvaluation(id: number, userId: number) {
  await prisma.csEvaluation.update({ where: { id }, data: { status: "APPROVED", approvedById: userId, approvedAt: new Date(), rejectedNote: null } });
  await writeAudit(userId, "cs_quality", "eval.approve", "csEvaluation", id, {});
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

// ── Analytics ─────────────────────────────────────────────────────────────────

export interface RepAnalytics {
  count: number;
  avgNormalized: number;
  byScope: { scope: string; count: number; avgNormalized: number }[];
  byMonth: { month: string; sum: number; count: number }[];
}

/** Approved-only analytics for one rep: per-scope averages + monthly sums. */
export async function repAnalytics(subjectUserId: number): Promise<RepAnalytics> {
  const evals = await prisma.csEvaluation.findMany({ where: { subjectUserId, status: "APPROVED", archivedAt: null }, select: { total: true, normalized: true, scope: true, callDate: true, createdAt: true } });
  const months = new Map<string, { sum: number; count: number }>();
  const scopes = new Map<string, { normSum: number; count: number }>();
  for (const e of evals) {
    const m = evalMonth(e);
    const cur = months.get(m) ?? { sum: 0, count: 0 };
    cur.sum += e.total;
    cur.count += 1;
    months.set(m, cur);
    const sc = scopes.get(e.scope) ?? { normSum: 0, count: 0 };
    sc.normSum += e.normalized;
    sc.count += 1;
    scopes.set(e.scope, sc);
  }
  return {
    count: evals.length,
    avgNormalized: evals.length ? round2(evals.reduce((s, e) => s + e.normalized, 0) / evals.length) : 0,
    byScope: CS_SCOPES.map((scope) => {
      const v = scopes.get(scope);
      return { scope, count: v?.count ?? 0, avgNormalized: v ? round2(v.normSum / v.count) : 0 };
    }),
    byMonth: [...months.entries()].map(([month, v]) => ({ month, sum: round2(v.sum), count: v.count })).sort((a, b) => a.month.localeCompare(b.month)),
  };
}

export interface RepSummary {
  id: number;
  name: string;
  count: number;
  avgNormalized: number;
  monthSum: number; // this month's Σ total
}

/** Approved-only per-rep leaderboard (avg normalized + this month's sum). */
export async function allRepsAnalytics(now: Date): Promise<RepSummary[]> {
  const mk = monthKey(now);
  const evals = await prisma.csEvaluation.findMany({ where: { status: "APPROVED", archivedAt: null }, select: { subjectUserId: true, total: true, normalized: true, scope: true, callDate: true, createdAt: true } });
  const by = new Map<number, { count: number; normSum: number; monthSum: number }>();
  for (const e of evals) {
    const cur = by.get(e.subjectUserId) ?? { count: 0, normSum: 0, monthSum: 0 };
    cur.count += 1;
    cur.normSum += e.normalized;
    if (evalMonth(e) === mk) cur.monthSum += e.total;
    by.set(e.subjectUserId, cur);
  }
  const names = await nameMap([...by.keys()]);
  return [...by.entries()]
    .map(([id, v]) => ({ id, name: names.get(id) ?? `#${id}`, count: v.count, avgNormalized: round2(v.normSum / v.count), monthSum: round2(v.monthSum) }))
    .sort((a, b) => b.avgNormalized - a.avgNormalized);
}
