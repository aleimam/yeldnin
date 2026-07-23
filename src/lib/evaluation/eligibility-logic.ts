// Pure eligibility engine for a 360 cycle: given the frozen participants + the
// connection graph, decide who evaluates whom and which criteria each pair sees.
// No DB/IO. Unit-tested. See EVALUATION.md §6-§8.

import { buildAdjacency, deptTier, deptWeight, scopeAllows, type DeptTier } from "./weighting-logic";

export interface Participant {
  empId: number;
  teams: number[]; // frozen Team.id memberships
  grade: number | null; // frozen Position.gradeLevel
}

export interface AssignmentPair {
  evaluatorEmpId: number;
  subjectEmpId: number;
  isSelf: boolean;
}

/** Every (evaluator → subject) assignment for a cycle, including each person's
 *  own self-evaluation. A non-self pair exists only if the evaluator's dept can
 *  reach the subject's dept at ≥ indirect (tier weight > 0). */
export function assignmentPairs(participants: Participant[], edges: Array<[number, number]>): AssignmentPair[] {
  const adj = buildAdjacency(edges);
  const out: AssignmentPair[] = [];
  for (const e of participants) {
    out.push({ evaluatorEmpId: e.empId, subjectEmpId: e.empId, isSelf: true });
    for (const s of participants) {
      if (s.empId === e.empId) continue;
      if (deptWeight(deptTier(e.teams, s.teams, adj)) > 0) {
        out.push({ evaluatorEmpId: e.empId, subjectEmpId: s.empId, isSelf: false });
      }
    }
  }
  return out;
}

/** The relationship tier for an (evaluator, subject) pair. */
export function pairTier(evaluator: Participant, subject: Participant, adj: Map<number, Set<number>>): DeptTier {
  return deptTier(evaluator.teams, subject.teams, adj);
}

/** Filter a subject's applicable criteria down to those this pair may rate.
 *  Self-evaluation sees everything (you are in your own department). */
export function visibleCriteria<T extends { raterScope: string }>(
  criteria: T[],
  tier: DeptTier,
  isSelf: boolean,
): T[] {
  if (isSelf) return criteria;
  return criteria.filter((c) => scopeAllows(c.raterScope, tier));
}

/** Does a subject's department set fall within a criterion's frozen applicability?
 *  Empty applicability (`teamIds` = []) means the criterion applies to everyone. */
export function criterionAppliesToSubject(applicabilityTeamIds: number[], subjectTeamIds: number[]): boolean {
  if (applicabilityTeamIds.length === 0) return true;
  return subjectTeamIds.some((t) => applicabilityTeamIds.includes(t));
}

/** Parse a stored CSV of ids ("" → []). */
export function parseIds(csv: string): number[] {
  return csv
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
}

/** Serialize ids to CSV for the frozen snapshot columns. */
export function serializeIds(ids: number[]): string {
  return [...new Set(ids)].join(",");
}

/** An evaluator is complete when every assignment (incl. self) is SUBMITTED or NA.
 *  Zero assignments (shouldn't happen — self always exists) counts as complete. */
export function evaluatorComplete(statuses: string[]): boolean {
  return statuses.every((s) => s === "SUBMITTED" || s === "NA");
}
