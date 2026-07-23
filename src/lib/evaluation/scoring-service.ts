import "server-only";
import { prisma } from "@/lib/db";
import { parseIds } from "./eligibility-logic";
import { computeScores, type ScoreParticipant, type ScoreEvaluation } from "./scoring-logic";

/**
 * Materialize a cycle's scores into EvalResult (+ effort coverage into
 * EvalFeedback). Reads the FROZEN snapshot so a re-run is deterministic and
 * idempotent (existing EvalResult rows for the cycle are replaced). Called on
 * close; safe to re-run. See EVALUATION.md §9-§11.
 */
export async function materializeCycle(cycleId: number): Promise<void> {
  const [participantRows, edgeRows, critRows, evalRows] = await Promise.all([
    prisma.evalCycleParticipant.findMany({ where: { cycleId } }),
    prisma.evalCycleEdge.findMany({ where: { cycleId } }),
    prisma.evalCycleCriterion.findMany({ where: { cycleId }, select: { criterionId: true, pillarId: true } }),
    prisma.evaluation.findMany({
      where: { cycleId },
      select: { evaluatorEmpId: true, subjectEmpId: true, isSelf: true, status: true, answers: { select: { criterionId: true, level: true } } },
    }),
  ]);

  const participants: ScoreParticipant[] = participantRows.map((p) => ({ empId: p.empId, grade: p.grade, teams: parseIds(p.teamIds) }));
  const edges: Array<[number, number]> = edgeRows.map((e) => [e.aId, e.bId]);
  const criterionPillar = new Map<number, number>(critRows.map((c) => [c.criterionId, c.pillarId]));
  const evaluations: ScoreEvaluation[] = evalRows.map((e) => ({
    evaluatorEmpId: e.evaluatorEmpId,
    subjectEmpId: e.subjectEmpId,
    isSelf: e.isSelf,
    status: e.status,
    answers: e.answers.map((a) => ({ criterionId: a.criterionId, level: a.level })),
  }));

  const { subjects, effortCoverage } = computeScores(participants, edges, criterionPillar, evaluations);

  // Build EvalResult rows (only where a peer score exists).
  const resultRows: {
    cycleId: number;
    subjectEmpId: number;
    scope: string;
    pillarId: number | null;
    criterionId: number | null;
    score: number;
    selfScore: number | null;
    responses: number;
  }[] = [];
  for (const [empId, s] of subjects) {
    if (s.overall != null) {
      resultRows.push({ cycleId, subjectEmpId: empId, scope: "OVERALL", pillarId: null, criterionId: null, score: s.overall, selfScore: s.self.overall, responses: s.overallResponses });
    }
    for (const [pillarId, agg] of s.pillars) {
      resultRows.push({ cycleId, subjectEmpId: empId, scope: "PILLAR", pillarId, criterionId: null, score: agg.score, selfScore: s.self.pillars.get(pillarId) ?? null, responses: agg.responses });
    }
    for (const [criterionId, agg] of s.criteria) {
      resultRows.push({ cycleId, subjectEmpId: empId, scope: "CRITERION", pillarId: null, criterionId, score: agg.score, selfScore: s.self.criteria.get(criterionId) ?? null, responses: agg.responses });
    }
  }

  await prisma.$transaction(
    async (tx) => {
      await tx.evalResult.deleteMany({ where: { cycleId } });
      if (resultRows.length) await tx.evalResult.createMany({ data: resultRows });
      for (const p of participantRows) {
        const cov = effortCoverage.get(p.empId) ?? null;
        await tx.evalFeedback.upsert({
          where: { cycleId_subjectEmpId: { cycleId, subjectEmpId: p.empId } },
          create: { cycleId, subjectEmpId: p.empId, effortCoverage: cov },
          update: { effortCoverage: cov },
        });
      }
    },
    { timeout: 30000 },
  );
}
