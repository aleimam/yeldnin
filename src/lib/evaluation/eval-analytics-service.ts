import "server-only";
import { prisma } from "@/lib/db";
import { parseIds } from "./eligibility-logic";
import { buildAdjacency, deptTier, deptWeight, levelWeight } from "./weighting-logic";
import { blendOverall } from "./eval-ai-logic";

const avg = (xs: number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export interface PillarResult {
  pillarId: number;
  name: string;
  nameAr: string | null;
  score: number;
  self: number | null;
  responses: number;
  provisional: boolean;
}

export interface MyResults {
  cycle: { id: number; name: string; status: string; closedAt: Date | null };
  hasData: boolean;
  overall: { score: number | null; self: number | null; responses: number; provisional: boolean; prevScore: number | null; delta: number | null };
  pillars: PillarResult[];
  effortCoveragePct: number | null;
  overallPct: number | null; // 0.85·peer% + 0.15·effort% (falls back to peer% until effort is scored)
  reportMd: string | null; // released AI report (P5)
  hasReport: boolean; // a released report exists (drives the PDF download)
  trend: { cycleName: string; overall: number }[];
}

/** Frozen pillar metadata (name/order) for a cycle, from its criteria snapshot. */
async function pillarInfoFor(cycleId: number) {
  const rows = await prisma.evalCycleCriterion.findMany({
    where: { cycleId },
    select: { pillarId: true, pillarName: true, pillarNameAr: true, pillarOrder: true },
  });
  const map = new Map<number, { name: string; nameAr: string | null; order: number }>();
  for (const r of rows) if (!map.has(r.pillarId)) map.set(r.pillarId, { name: r.pillarName, nameAr: r.pillarNameAr, order: r.pillarOrder });
  return map;
}

/** One subject's materialized results for a (closed) cycle, incl. self-vs-others,
 *  response counts + sufficiency flag, effort, and the cross-cycle overall trend. */
export async function myResults(cycleId: number, subjectEmpId: number): Promise<MyResults | null> {
  const cycle = await prisma.evalCycle.findUnique({ where: { id: cycleId }, select: { id: true, name: true, status: true, closedAt: true } });
  if (!cycle) return null;

  const [pillarInfo, results, fb] = await Promise.all([
    pillarInfoFor(cycleId),
    prisma.evalResult.findMany({ where: { cycleId, subjectEmpId } }),
    prisma.evalFeedback.findUnique({ where: { cycleId_subjectEmpId: { cycleId, subjectEmpId } } }),
  ]);

  const overallRow = results.find((r) => r.scope === "OVERALL");
  const pillars: PillarResult[] = results
    .filter((r) => r.scope === "PILLAR" && r.pillarId != null)
    .map((r) => {
      const info = pillarInfo.get(r.pillarId!) ?? { name: `#${r.pillarId}`, nameAr: null, order: 0 };
      return { pillarId: r.pillarId!, name: info.name, nameAr: info.nameAr, score: r.score, self: r.selfScore, responses: r.responses, provisional: r.responses < 3 };
    })
    .sort((a, b) => (pillarInfo.get(a.pillarId)?.order ?? 0) - (pillarInfo.get(b.pillarId)?.order ?? 0));

  const effortCoveragePct = fb?.effortCoverage != null ? Math.round(fb.effortCoverage * 100) : null;
  const reportMd = fb?.status === "RELEASED" ? fb.editedMd ?? fb.draftMd : null;
  const overallPct = blendOverall(overallRow?.score ?? null, fb?.effortScore ?? null);

  // Cross-cycle overall trend (chronological, closed cycles only).
  const overallAll = await prisma.evalResult.findMany({ where: { subjectEmpId, scope: "OVERALL" }, select: { cycleId: true, score: true } });
  const metas = await prisma.evalCycle.findMany({
    where: { id: { in: overallAll.map((o) => o.cycleId) }, status: "CLOSED" },
    select: { id: true, name: true, startedAt: true },
  });
  const metaById = new Map(metas.map((c) => [c.id, c]));
  const chron = overallAll
    .filter((o) => metaById.has(o.cycleId))
    .map((o) => ({ cycleId: o.cycleId, name: metaById.get(o.cycleId)!.name, startedAt: metaById.get(o.cycleId)!.startedAt, overall: o.score }))
    .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  const idx = chron.findIndex((t) => t.cycleId === cycleId);
  const prevScore = idx > 0 ? chron[idx - 1].overall : null;
  const curScore = overallRow?.score ?? null;

  return {
    cycle: { id: cycle.id, name: cycle.name, status: cycle.status, closedAt: cycle.closedAt },
    hasData: !!overallRow,
    overall: {
      score: curScore,
      self: overallRow?.selfScore ?? null,
      responses: overallRow?.responses ?? 0,
      provisional: (overallRow?.responses ?? 0) < 3,
      prevScore,
      delta: curScore != null && prevScore != null ? curScore - prevScore : null,
    },
    pillars,
    effortCoveragePct,
    overallPct,
    reportMd,
    hasReport: !!reportMd,
    trend: chron.map((t) => ({ cycleName: t.name, overall: t.overall })),
  };
}

/** The most recent closed cycle where this employee has an overall result. */
export async function latestResultCycle(subjectEmpId: number): Promise<number | null> {
  const rows = await prisma.evalResult.findMany({ where: { subjectEmpId, scope: "OVERALL" }, select: { cycleId: true } });
  if (!rows.length) return null;
  const latest = await prisma.evalCycle.findFirst({
    where: { id: { in: rows.map((r) => r.cycleId) }, status: "CLOSED" },
    orderBy: { startedAt: "desc" },
    select: { id: true },
  });
  return latest?.id ?? null;
}

// ── Admin analytics ──────────────────────────────────────────────────────────

export async function listClosedCycles() {
  return prisma.evalCycle.findMany({ where: { status: "CLOSED" }, orderBy: { startedAt: "desc" }, select: { id: true, name: true, closedAt: true } });
}

async function subjectIdsInScope(cycleId: number, teamId?: number | null): Promise<number[]> {
  const parts = await prisma.evalCycleParticipant.findMany({ where: { cycleId }, select: { empId: true, teamIds: true } });
  if (teamId == null) return parts.map((p) => p.empId);
  return parts.filter((p) => parseIds(p.teamIds).includes(teamId)).map((p) => p.empId);
}

export interface ScopeAnalytics {
  overall: { avg: number | null; responses: number; subjects: number };
  pillars: { pillarId: number; name: string; nameAr: string | null; avg: number | null; responses: number }[];
}

/** Company-wide (teamId null) or per-department aggregate for a closed cycle. */
export async function scopeAnalytics(cycleId: number, teamId?: number | null): Promise<ScopeAnalytics> {
  const [subjIds, pillarInfo] = await Promise.all([subjectIdsInScope(cycleId, teamId), pillarInfoFor(cycleId)]);
  if (!subjIds.length) return { overall: { avg: null, responses: 0, subjects: 0 }, pillars: [] };
  const results = await prisma.evalResult.findMany({
    where: { cycleId, subjectEmpId: { in: subjIds }, scope: { in: ["OVERALL", "PILLAR"] } },
  });
  const overalls = results.filter((r) => r.scope === "OVERALL");
  const byPillar = new Map<number, { scores: number[]; resp: number }>();
  for (const r of results) {
    if (r.scope !== "PILLAR" || r.pillarId == null) continue;
    const g = byPillar.get(r.pillarId) ?? { scores: [], resp: 0 };
    g.scores.push(r.score);
    g.resp += r.responses;
    byPillar.set(r.pillarId, g);
  }
  const pillars = [...byPillar.entries()]
    .map(([pid, g]) => ({ pid, name: pillarInfo.get(pid)?.name ?? `#${pid}`, nameAr: pillarInfo.get(pid)?.nameAr ?? null, avg: avg(g.scores), responses: g.resp, order: pillarInfo.get(pid)?.order ?? 0 }))
    .sort((a, b) => a.order - b.order)
    .map((p) => ({ pillarId: p.pid, name: p.name, nameAr: p.nameAr, avg: p.avg, responses: p.responses }));
  return {
    overall: { avg: avg(overalls.map((r) => r.score)), responses: overalls.reduce((a, r) => a + r.responses, 0), subjects: overalls.length },
    pillars,
  };
}

/** Every participant with their overall + responses (the By-employee picker + list). */
export async function participantsWithOverall(cycleId: number) {
  const parts = await prisma.evalCycleParticipant.findMany({ where: { cycleId }, select: { empId: true } });
  const ids = parts.map((p) => p.empId);
  if (!ids.length) return [];
  const [emps, overalls] = await Promise.all([
    prisma.employee.findMany({ where: { id: { in: ids } }, select: { id: true, user: { select: { name: true, nameAr: true } } } }),
    prisma.evalResult.findMany({ where: { cycleId, scope: "OVERALL", subjectEmpId: { in: ids } }, select: { subjectEmpId: true, score: true, responses: true } }),
  ]);
  const oById = new Map(overalls.map((o) => [o.subjectEmpId, o]));
  const nById = new Map(emps.map((e) => [e.id, e.user]));
  return ids
    .map((id) => ({ empId: id, name: nById.get(id)?.name ?? `#${id}`, nameAr: nById.get(id)?.nameAr ?? null, overall: oById.get(id)?.score ?? null, responses: oById.get(id)?.responses ?? 0 }))
    .sort((a, b) => (b.overall ?? -1) - (a.overall ?? -1) || a.name.localeCompare(b.name));
}

export interface RaterRow {
  evaluatorEmpId: number;
  name: string;
  nameAr: string | null;
  isSelf: boolean;
  status: string;
  overallComment: string | null;
  weightShare: number | null; // fraction of total peer weight on this subject
  answerCount: number;
  dominant: boolean; // weightShare > 0.4 on thin data (advisory)
}

/** Admin-only per-subject rater detail: who rated them, their comment, weight
 *  share (identities visible to admins only — see EVALUATION.md §10/§15). */
export async function raterDetail(cycleId: number, subjectEmpId: number): Promise<RaterRow[]> {
  const [evals, partRows, edgeRows] = await Promise.all([
    prisma.evaluation.findMany({
      where: { cycleId, subjectEmpId },
      select: { evaluatorEmpId: true, isSelf: true, status: true, overallComment: true, answers: { select: { id: true } } },
    }),
    prisma.evalCycleParticipant.findMany({ where: { cycleId } }),
    prisma.evalCycleEdge.findMany({ where: { cycleId } }),
  ]);
  const partById = new Map(partRows.map((p) => [p.empId, { grade: p.grade, teams: parseIds(p.teamIds) }]));
  const adj = buildAdjacency(edgeRows.map((e) => [e.aId, e.bId]));
  const subj = partById.get(subjectEmpId);

  const weightOf = (evEmp: number): number => {
    const ev = partById.get(evEmp);
    if (!ev || !subj) return 0;
    return levelWeight(ev.grade, subj.grade) * deptWeight(deptTier(ev.teams, subj.teams, adj));
  };
  const totalWeight = evals.filter((e) => !e.isSelf && e.status !== "NA" && e.answers.length > 0).reduce((a, e) => a + weightOf(e.evaluatorEmpId), 0);

  const empIds = evals.map((e) => e.evaluatorEmpId);
  const emps = empIds.length ? await prisma.employee.findMany({ where: { id: { in: empIds } }, select: { id: true, user: { select: { name: true, nameAr: true } } } }) : [];
  const nById = new Map(emps.map((e) => [e.id, e.user]));

  return evals
    .map((e) => {
      const contributes = !e.isSelf && e.status !== "NA" && e.answers.length > 0;
      const share = contributes && totalWeight > 0 ? weightOf(e.evaluatorEmpId) / totalWeight : null;
      return {
        evaluatorEmpId: e.evaluatorEmpId,
        name: nById.get(e.evaluatorEmpId)?.name ?? `#${e.evaluatorEmpId}`,
        nameAr: nById.get(e.evaluatorEmpId)?.nameAr ?? null,
        isSelf: e.isSelf,
        status: e.status,
        overallComment: e.overallComment,
        weightShare: share,
        answerCount: e.answers.length,
        dominant: share != null && share > 0.4,
      };
    })
    .sort((a, b) => (a.isSelf === b.isSelf ? (b.weightShare ?? -1) - (a.weightShare ?? -1) : a.isSelf ? 1 : -1));
}

export interface FairnessFlag {
  type: "straight_liner" | "dominant_rater";
  evaluatorName?: string;
  subjectName?: string;
  detail: string;
}

/** Advisory, flag-only fairness signals (no score tampering). Cheap subset:
 *  straight-liners (zero-variance raters) + dominant raters (one voice > 40 %). */
export async function fairnessFlags(cycleId: number): Promise<FairnessFlag[]> {
  const [evals, partRows, edgeRows] = await Promise.all([
    prisma.evaluation.findMany({
      where: { cycleId, isSelf: false, status: { not: "NA" } },
      select: { evaluatorEmpId: true, subjectEmpId: true, answers: { select: { level: true } } },
    }),
    prisma.evalCycleParticipant.findMany({ where: { cycleId } }),
    prisma.evalCycleEdge.findMany({ where: { cycleId } }),
  ]);
  const partById = new Map(partRows.map((p) => [p.empId, { grade: p.grade, teams: parseIds(p.teamIds) }]));
  const adj = buildAdjacency(edgeRows.map((e) => [e.aId, e.bId]));
  const empIds = [...new Set([...evals.map((e) => e.evaluatorEmpId), ...evals.map((e) => e.subjectEmpId)])];
  const emps = empIds.length ? await prisma.employee.findMany({ where: { id: { in: empIds } }, select: { id: true, user: { select: { name: true } } } }) : [];
  const nameById = new Map(emps.map((e) => [e.id, e.user.name]));

  const flags: FairnessFlag[] = [];

  // Straight-liner: an evaluator whose ≥5 answers across the cycle are all identical.
  const byEval = new Map<number, number[]>();
  for (const e of evals) for (const a of e.answers) (byEval.get(e.evaluatorEmpId) ?? byEval.set(e.evaluatorEmpId, []).get(e.evaluatorEmpId)!).push(a.level);
  for (const [emp, levels] of byEval) {
    if (levels.length >= 5 && new Set(levels).size === 1) {
      flags.push({ type: "straight_liner", evaluatorName: nameById.get(emp), detail: `${levels.length} × ${levels[0]}` });
    }
  }

  // Dominant rater: per subject, one contributing rater holds > 40 % of peer weight.
  const weightOf = (evEmp: number, subjEmp: number): number => {
    const ev = partById.get(evEmp);
    const su = partById.get(subjEmp);
    if (!ev || !su) return 0;
    return levelWeight(ev.grade, su.grade) * deptWeight(deptTier(ev.teams, su.teams, adj));
  };
  const bySubject = new Map<number, { evEmp: number; w: number }[]>();
  for (const e of evals) {
    if (!e.answers.length) continue;
    (bySubject.get(e.subjectEmpId) ?? bySubject.set(e.subjectEmpId, []).get(e.subjectEmpId)!).push({ evEmp: e.evaluatorEmpId, w: weightOf(e.evaluatorEmpId, e.subjectEmpId) });
  }
  for (const [subj, raters] of bySubject) {
    const total = raters.reduce((a, r) => a + r.w, 0);
    if (total <= 0) continue;
    const top = raters.reduce((m, r) => (r.w > m.w ? r : m), raters[0]);
    if (top.w / total > 0.4) {
      flags.push({ type: "dominant_rater", subjectName: nameById.get(subj), evaluatorName: nameById.get(top.evEmp), detail: `${Math.round((top.w / total) * 100)}%` });
    }
  }
  return flags;
}

/** Long-form CSV: one row per evaluator → subject → criterion (+ overall comment). */
export async function csvLongForm(cycleId: number): Promise<string> {
  const [evals, critRows, partRows] = await Promise.all([
    prisma.evaluation.findMany({
      where: { cycleId },
      select: { evaluatorEmpId: true, subjectEmpId: true, isSelf: true, status: true, overallComment: true, answers: { select: { criterionId: true, level: true, note: true } } },
    }),
    prisma.evalCycleCriterion.findMany({ where: { cycleId }, select: { criterionId: true, title: true, pillarName: true } }),
    prisma.evalCycleParticipant.findMany({ where: { cycleId }, select: { empId: true } }),
  ]);
  const critById = new Map(critRows.map((c) => [c.criterionId, c]));
  const empIds = partRows.map((p) => p.empId);
  const emps = empIds.length ? await prisma.employee.findMany({ where: { id: { in: empIds } }, select: { id: true, user: { select: { name: true } } } }) : [];
  const nameById = new Map(emps.map((e) => [e.id, e.user.name]));

  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows: string[] = ["Evaluator,Subject,Self,Status,Pillar,Criterion,Score,Note,OverallComment"];
  for (const e of evals) {
    const evName = nameById.get(e.evaluatorEmpId) ?? `#${e.evaluatorEmpId}`;
    const suName = nameById.get(e.subjectEmpId) ?? `#${e.subjectEmpId}`;
    const base = [esc(evName), esc(suName), e.isSelf ? "yes" : "no", e.status];
    if (e.answers.length === 0) {
      rows.push([...base, "", "", "", "", esc(e.overallComment ?? "")].join(","));
    } else {
      for (const a of e.answers) {
        const c = critById.get(a.criterionId);
        rows.push([...base, esc(c?.pillarName ?? ""), esc(c?.title ?? `#${a.criterionId}`), String(a.level), esc(a.note ?? ""), esc(e.overallComment ?? "")].join(","));
      }
    }
  }
  return rows.join("\r\n");
}
