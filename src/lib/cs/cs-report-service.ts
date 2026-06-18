import "server-only";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { round2 } from "./cs-logic";

const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

async function nameMap(ids: number[]): Promise<Map<number, string>> {
  if (!ids.length) return new Map();
  const u = await prisma.user.findMany({ where: { id: { in: [...new Set(ids)] } }, select: { id: true, name: true, fullName: true } });
  return new Map(u.map((x) => [x.id, x.fullName || x.name]));
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
  createdAt: Date;
}

/** Evaluations list. `showEvaluator` reveals the evaluator (hidden from reps). */
export async function listEvaluations(opts: { status?: string; subjectUserId?: number; showEvaluator: boolean }): Promise<EvalListRow[]> {
  const evals = await prisma.csEvaluation.findMany({
    where: { ...(opts.status ? { status: opts.status } : {}), ...(opts.subjectUserId ? { subjectUserId: opts.subjectUserId } : {}) },
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
    createdAt: e.createdAt,
  }));
}

export async function getEvaluationDetail(id: number) {
  const ev = await prisma.csEvaluation.findUnique({ where: { id }, include: { answers: { orderBy: { id: "asc" } }, photos: true } });
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

// ── Analytics ─────────────────────────────────────────────────────────────────

export interface RepAnalytics {
  count: number;
  avgNormalized: number;
  byMonth: { month: string; sum: number; count: number }[];
  byCriteria: { criteria: string; avg: number; count: number }[];
}

/** Approved-only analytics for one rep: monthly sums + per-criterion averages. */
export async function repAnalytics(subjectUserId: number): Promise<RepAnalytics> {
  const evals = await prisma.csEvaluation.findMany({ where: { subjectUserId, status: "APPROVED" }, select: { total: true, normalized: true, createdAt: true } });
  const months = new Map<string, { sum: number; count: number }>();
  for (const e of evals) {
    const m = monthKey(e.createdAt);
    const cur = months.get(m) ?? { sum: 0, count: 0 };
    cur.sum += e.total;
    cur.count += 1;
    months.set(m, cur);
  }
  const answers = await prisma.csEvaluationAnswer.findMany({ where: { evaluation: { subjectUserId, status: "APPROVED" } }, select: { criteria: true, value: true } });
  const crit = new Map<string, { sum: number; count: number }>();
  for (const a of answers) {
    const c = crit.get(a.criteria) ?? { sum: 0, count: 0 };
    c.sum += a.value;
    c.count += 1;
    crit.set(a.criteria, c);
  }
  return {
    count: evals.length,
    avgNormalized: evals.length ? round2(evals.reduce((s, e) => s + e.normalized, 0) / evals.length) : 0,
    byMonth: [...months.entries()].map(([month, v]) => ({ month, sum: round2(v.sum), count: v.count })).sort((a, b) => a.month.localeCompare(b.month)),
    byCriteria: [...crit.entries()].map(([criteria, v]) => ({ criteria, avg: round2(v.sum / v.count), count: v.count })).sort((a, b) => b.avg - a.avg),
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
  const evals = await prisma.csEvaluation.findMany({ where: { status: "APPROVED" }, select: { subjectUserId: true, total: true, normalized: true, createdAt: true } });
  const by = new Map<number, { count: number; normSum: number; monthSum: number }>();
  for (const e of evals) {
    const cur = by.get(e.subjectUserId) ?? { count: 0, normSum: 0, monthSum: 0 };
    cur.count += 1;
    cur.normSum += e.normalized;
    if (monthKey(e.createdAt) === mk) cur.monthSum += e.total;
    by.set(e.subjectUserId, cur);
  }
  const names = await nameMap([...by.keys()]);
  return [...by.entries()]
    .map(([id, v]) => ({ id, name: names.get(id) ?? `#${id}`, count: v.count, avgNormalized: round2(v.normSum / v.count), monthSum: round2(v.monthSum) }))
    .sort((a, b) => b.avgNormalized - a.avgNormalized);
}
