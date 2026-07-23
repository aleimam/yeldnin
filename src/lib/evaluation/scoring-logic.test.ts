import { describe, it, expect } from "vitest";
import { normalizationScale, computeScores, type ScoreParticipant, type ScoreEvaluation } from "./scoring-logic";

describe("normalizationScale", () => {
  it("uses raw (scale 1) below the 10-answer floor", () => {
    expect(normalizationScale([5, 5, 5])).toBe(1);
    expect(normalizationScale(Array(9).fill(2))).toBe(1);
  });
  it("re-anchors to mean 4 at/above the floor", () => {
    expect(normalizationScale(Array(10).fill(2))).toBe(2); // 4/2
    const levels = [1, 2, 3, 4, 5, 4, 3, 2, 4, 4.2];
    const m = levels.reduce((a, b) => a + b, 0) / levels.length;
    expect(normalizationScale(levels)).toBeCloseTo(4 / m, 6);
  });
});

// Scenario: teams 1 and 3, one edge (direct). A,B in team1; C in team3 (higher grade).
const EDGES: Array<[number, number]> = [[1, 3]];
const critPillar = new Map<number, number>([
  [10, 100],
  [11, 100],
  [20, 200],
]);
const P = (empId: number, grade: number | null, teams: number[]): ScoreParticipant => ({ empId, grade, teams });

describe("computeScores — weighting, aggregation, roll-up, self, effort", () => {
  const participants = [P(1, 2, [1]), P(2, 2, [1]), P(3, 3, [3])];
  const evaluations: ScoreEvaluation[] = [
    // B(2) → A(1): same dept (×4), same grade (×2) = weight 8
    { evaluatorEmpId: 2, subjectEmpId: 1, isSelf: false, status: "SUBMITTED", answers: [{ criterionId: 10, level: 4 }, { criterionId: 11, level: 2 }] },
    // C(3) → A(1): direct (×2), higher grade (×4) = weight 8
    { evaluatorEmpId: 3, subjectEmpId: 1, isSelf: false, status: "SUBMITTED", answers: [{ criterionId: 10, level: 5 }] },
    // A self
    { evaluatorEmpId: 1, subjectEmpId: 1, isSelf: true, status: "SUBMITTED", answers: [{ criterionId: 10, level: 3 }] },
  ];
  const { subjects, effortCoverage } = computeScores(participants, EDGES, critPillar, evaluations);
  const a = subjects.get(1)!;

  it("aggregates a criterion as the weighted mean of normalized votes", () => {
    // both scales are 1 (each rater < 10 answers): (8*4 + 8*5)/16 = 4.5
    expect(a.criteria.get(10)!.score).toBeCloseTo(4.5, 6);
    expect(a.criteria.get(10)!.responses).toBe(2);
    expect(a.criteria.get(11)!.score).toBeCloseTo(2, 6);
    expect(a.criteria.get(11)!.responses).toBe(1);
  });
  it("rolls a pillar up as the mean of its criterion scores", () => {
    expect(a.pillars.get(100)!.score).toBeCloseTo((4.5 + 2) / 2, 6);
    expect(a.pillars.get(100)!.responses).toBe(2); // distinct raters B,C
  });
  it("rolls overall up over criterion scores (not mean-of-pillars)", () => {
    expect(a.overall).toBeCloseTo(3.25, 6);
    expect(a.overallResponses).toBe(2);
  });
  it("keeps self side-by-side, excluded from the peer aggregate", () => {
    expect(a.self.overall).toBeCloseTo(3, 6);
    expect(a.self.criteria.get(10)).toBe(3);
    expect(a.self.pillars.get(100)).toBeCloseTo(3, 6);
  });
  it("computes effort coverage as submitted/eligible, null when no eligible peers", () => {
    expect(effortCoverage.get(2)).toBe(1); // B submitted its 1 assignment
    expect(effortCoverage.get(3)).toBe(1);
    expect(effortCoverage.get(1)).toBeNull(); // A had no non-self assignments here
  });
});

describe("computeScores — normalization is applied in aggregation", () => {
  it("scales a lenient evaluator's votes toward mean 4", () => {
    // D rates 5 subjects, 2 criteria each, all level 2 → pool of 10, mean 2 → scale 2.
    const parts = [P(20, 2, [1]), ...[11, 12, 13, 14, 15].map((id) => P(id, 2, [1]))];
    const evals: ScoreEvaluation[] = [11, 12, 13, 14, 15].map((sid) => ({
      evaluatorEmpId: 20,
      subjectEmpId: sid,
      isSelf: false,
      status: "SUBMITTED",
      answers: [{ criterionId: 10, level: 2 }, { criterionId: 11, level: 2 }],
    }));
    const { subjects } = computeScores(parts, EDGES, critPillar, evals);
    // D is the sole rater of emp11; level 2 × scale 2 = 4
    expect(subjects.get(11)!.criteria.get(10)!.score).toBeCloseTo(4, 6);
  });
});

describe("computeScores — excludes NA and self from the peer pool", () => {
  it("ignores NA evaluations entirely", () => {
    const parts = [P(1, 2, [1]), P(2, 2, [1])];
    const evals: ScoreEvaluation[] = [
      { evaluatorEmpId: 2, subjectEmpId: 1, isSelf: false, status: "NA", answers: [] },
      { evaluatorEmpId: 1, subjectEmpId: 1, isSelf: true, status: "SUBMITTED", answers: [{ criterionId: 10, level: 5 }] },
    ];
    const { subjects, effortCoverage } = computeScores(parts, EDGES, critPillar, evals);
    expect(subjects.get(1)!.overall).toBeNull(); // no peer data
    expect(effortCoverage.get(2)).toBe(0); // 1 eligible, 0 submitted (NA)
  });
});
