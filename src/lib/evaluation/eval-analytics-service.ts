import "server-only";
import { prisma } from "@/lib/db";

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
  reportMd: string | null; // released AI report (P5)
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
    reportMd,
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
