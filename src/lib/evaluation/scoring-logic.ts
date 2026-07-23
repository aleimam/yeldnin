// Pure scoring engine for a closed 360 cycle. No DB/IO. Unit-tested.
// Order: normalize per evaluator → weight each vote → aggregate by criterion →
// roll up to pillar + overall. Self is kept side-by-side, excluded from the peer
// aggregate + from normalization. See EVALUATION.md §9-§11.

import { buildAdjacency, deptTier, deptWeight, levelWeight } from "./weighting-logic";

export interface ScoreParticipant {
  empId: number;
  grade: number | null; // frozen Position.gradeLevel
  teams: number[]; // frozen department ids
}
export interface ScoreAnswer {
  criterionId: number;
  level: number; // 1..5
}
export interface ScoreEvaluation {
  evaluatorEmpId: number;
  subjectEmpId: number;
  isSelf: boolean;
  status: string; // PENDING | SUBMITTED | NA
  answers: ScoreAnswer[];
}

/** Per-evaluator normalization scale: <10 answers → 1 (raw, small-sample floor);
 *  else 4 / mean so every evaluator re-anchors to a mean of 4. No clamp downstream. */
export function normalizationScale(levels: number[]): number {
  if (levels.length < 10) return 1;
  const mean = levels.reduce((a, b) => a + b, 0) / levels.length;
  return mean > 0 ? 4 / mean : 1;
}

export interface CriterionAgg {
  score: number;
  responses: number;
}

export interface SubjectScores {
  overall: number | null;
  overallResponses: number; // distinct peer raters of this subject
  criteria: Map<number, CriterionAgg>; // criterionId → weighted aggregate
  pillars: Map<number, CriterionAgg>; // pillarId → mean of its criterion scores
  self: {
    overall: number | null;
    criteria: Map<number, number>; // criterionId → raw self level
    pillars: Map<number, number>; // pillarId → mean of self levels
  };
}

export interface CycleScores {
  subjects: Map<number, SubjectScores>;
  effortCoverage: Map<number, number | null>; // evaluatorEmpId → submitted/eligible, or null if 0 eligible peers
}

const mean = (xs: number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Peer vote weight for an (evaluator → subject) pair from frozen data. */
function pairWeight(ev: ScoreParticipant, subj: ScoreParticipant, adj: Map<number, Set<number>>): number {
  return levelWeight(ev.grade, subj.grade) * deptWeight(deptTier(ev.teams, subj.teams, adj));
}

export function computeScores(
  participants: ScoreParticipant[],
  edges: Array<[number, number]>,
  criterionPillar: Map<number, number>, // criterionId → pillarId (frozen set)
  evaluations: ScoreEvaluation[],
): CycleScores {
  const adj = buildAdjacency(edges);
  const partById = new Map(participants.map((p) => [p.empId, p]));

  // 1) Normalization scale per evaluator — pool = all non-self, non-NA answers.
  const poolByEval = new Map<number, number[]>();
  for (const ev of evaluations) {
    if (ev.isSelf || ev.status === "NA") continue;
    const arr = poolByEval.get(ev.evaluatorEmpId) ?? [];
    for (const a of ev.answers) arr.push(a.level);
    poolByEval.set(ev.evaluatorEmpId, arr);
  }
  const scaleByEval = new Map<number, number>();
  for (const [e, levels] of poolByEval) scaleByEval.set(e, normalizationScale(levels));

  // 2) Collect weighted normalized votes per (subject, criterion).
  //    votes: subjectId → criterionId → {wSum, wnSum, raters:Set}
  interface Acc {
    wSum: number;
    wnSum: number;
    raters: Set<number>;
  }
  const bySubject = new Map<number, Map<number, Acc>>();
  const subjRaters = new Map<number, Set<number>>(); // distinct peer raters per subject
  const subjPillarRaters = new Map<number, Map<number, Set<number>>>(); // subject → pillar → raters

  for (const ev of evaluations) {
    if (ev.isSelf || ev.status === "NA" || ev.answers.length === 0) continue;
    const evP = partById.get(ev.evaluatorEmpId);
    const subP = partById.get(ev.subjectEmpId);
    if (!evP || !subP) continue;
    const w = pairWeight(evP, subP, adj);
    if (w <= 0) continue;
    const scale = scaleByEval.get(ev.evaluatorEmpId) ?? 1;

    let critMap = bySubject.get(ev.subjectEmpId);
    if (!critMap) bySubject.set(ev.subjectEmpId, (critMap = new Map()));
    let rSet = subjRaters.get(ev.subjectEmpId);
    if (!rSet) subjRaters.set(ev.subjectEmpId, (rSet = new Set()));
    let pMap = subjPillarRaters.get(ev.subjectEmpId);
    if (!pMap) subjPillarRaters.set(ev.subjectEmpId, (pMap = new Map()));

    for (const a of ev.answers) {
      const norm = a.level * scale;
      let acc = critMap.get(a.criterionId);
      if (!acc) critMap.set(a.criterionId, (acc = { wSum: 0, wnSum: 0, raters: new Set() }));
      acc.wSum += w;
      acc.wnSum += w * norm;
      acc.raters.add(ev.evaluatorEmpId);
      rSet.add(ev.evaluatorEmpId);
      const pid = criterionPillar.get(a.criterionId);
      if (pid != null) {
        let ps = pMap.get(pid);
        if (!ps) pMap.set(pid, (ps = new Set()));
        ps.add(ev.evaluatorEmpId);
      }
    }
  }

  // 3) Self answers per subject.
  const selfBySubject = new Map<number, Map<number, number>>();
  for (const ev of evaluations) {
    if (!ev.isSelf) continue;
    const m = new Map<number, number>();
    for (const a of ev.answers) m.set(a.criterionId, a.level);
    selfBySubject.set(ev.subjectEmpId, m);
  }

  // 4) Roll up per subject.
  const subjects = new Map<number, SubjectScores>();
  const allSubjectIds = new Set<number>([...participants.map((p) => p.empId)]);
  for (const id of allSubjectIds) {
    const critMap = bySubject.get(id) ?? new Map<number, Acc>();
    const criteria = new Map<number, CriterionAgg>();
    const critScores: number[] = [];
    const pillarBuckets = new Map<number, number[]>();
    for (const [cid, acc] of critMap) {
      if (acc.wSum <= 0) continue;
      const score = acc.wnSum / acc.wSum;
      criteria.set(cid, { score, responses: acc.raters.size });
      critScores.push(score);
      const pid = criterionPillar.get(cid);
      if (pid != null) (pillarBuckets.get(pid) ?? pillarBuckets.set(pid, []).get(pid)!).push(score);
    }
    const pillars = new Map<number, CriterionAgg>();
    const pRaters = subjPillarRaters.get(id);
    for (const [pid, scores] of pillarBuckets) {
      const m = mean(scores);
      if (m != null) pillars.set(pid, { score: m, responses: pRaters?.get(pid)?.size ?? 0 });
    }

    // Self side-by-side.
    const selfMap = selfBySubject.get(id) ?? new Map<number, number>();
    const selfCriteria = new Map<number, number>();
    const selfPillarBuckets = new Map<number, number[]>();
    for (const [cid, lvl] of selfMap) {
      selfCriteria.set(cid, lvl);
      const pid = criterionPillar.get(cid);
      if (pid != null) (selfPillarBuckets.get(pid) ?? selfPillarBuckets.set(pid, []).get(pid)!).push(lvl);
    }
    const selfPillars = new Map<number, number>();
    for (const [pid, xs] of selfPillarBuckets) {
      const m = mean(xs);
      if (m != null) selfPillars.set(pid, m);
    }

    subjects.set(id, {
      overall: mean(critScores),
      overallResponses: subjRaters.get(id)?.size ?? 0,
      criteria,
      pillars,
      self: { overall: mean([...selfMap.values()]), criteria: selfCriteria, pillars: selfPillars },
    });
  }

  // 5) Effort coverage per evaluator = submitted / eligible non-self assignments.
  const effortCoverage = new Map<number, number | null>();
  const tally = new Map<number, { total: number; submitted: number }>();
  for (const ev of evaluations) {
    if (ev.isSelf) continue;
    const t = tally.get(ev.evaluatorEmpId) ?? { total: 0, submitted: 0 };
    t.total++;
    if (ev.status === "SUBMITTED") t.submitted++;
    tally.set(ev.evaluatorEmpId, t);
  }
  for (const p of participants) {
    const t = tally.get(p.empId);
    effortCoverage.set(p.empId, t && t.total > 0 ? t.submitted / t.total : null);
  }

  return { subjects, effortCoverage };
}
