// Pure org-graph + weighting logic for the 360 Reviews module. No DB/IO.
// Unit-tested. "Department" == the app's Team; connections are undirected edges
// between teams. See EVALUATION.md §6.

export type DeptTier = "SAME" | "DIRECT" | "INDIRECT" | "NONE";

/** Normalize an undirected edge to `[min, max]` so a pair is stored once. */
export function normalizeEdge(a: number, b: number): [number, number] {
  return a <= b ? [a, b] : [b, a];
}

/** teamId → set of directly-connected teamIds (both directions). Self-edges ignored. */
export function buildAdjacency(edges: Array<[number, number]>): Map<number, Set<number>> {
  const adj = new Map<number, Set<number>>();
  const link = (x: number, y: number) => {
    let s = adj.get(x);
    if (!s) adj.set(x, (s = new Set()));
    s.add(y);
  };
  for (const [a, b] of edges) {
    if (a !== b) {
      link(a, b);
      link(b, a);
    }
  }
  return adj;
}

/** Relationship tier between two single teams given the adjacency map. */
function tierBetween(a: number, b: number, adj: Map<number, Set<number>>): DeptTier {
  if (a === b) return "SAME";
  const na = adj.get(a);
  if (!na) return "NONE";
  if (na.has(b)) return "DIRECT";
  // indirect = a common neighbour exists (exactly 2 hops), and not same/direct
  for (const m of na) if (adj.get(m)?.has(b)) return "INDIRECT";
  return "NONE";
}

const RANK: Record<DeptTier, number> = { SAME: 3, DIRECT: 2, INDIRECT: 1, NONE: 0 };

/** The **highest** relationship tier across every (evaluatorTeam × subjectTeam)
 *  pair — multi-team employees take their strongest link. */
export function deptTier(evaluatorTeams: number[], subjectTeams: number[], adj: Map<number, Set<number>>): DeptTier {
  let best: DeptTier = "NONE";
  for (const a of evaluatorTeams) {
    for (const b of subjectTeams) {
      const tier = tierBetween(a, b, adj);
      if (RANK[tier] > RANK[best]) best = tier;
      if (best === "SAME") return best;
    }
  }
  return best;
}

/** Department weight from a tier: same 4, direct 2, indirect 1, none 0. */
export function deptWeight(tier: DeptTier): number {
  return tier === "SAME" ? 4 : tier === "DIRECT" ? 2 : tier === "INDIRECT" ? 1 : 0;
}

/** Can the evaluator evaluate the subject at all? (tier reaches ≥ indirect) */
export function canEvaluate(evaluatorTeams: number[], subjectTeams: number[], adj: Map<number, Set<number>>): boolean {
  return deptWeight(deptTier(evaluatorTeams, subjectTeams, adj)) > 0;
}

/** Does a criterion's rater scope permit this tier?
 *  ANY → same/direct/indirect · CONNECTED → same/direct · SAME_DEPT → same. */
export function scopeAllows(scope: string, tier: DeptTier): boolean {
  if (scope === "SAME_DEPT") return tier === "SAME";
  if (scope === "CONNECTED") return tier === "SAME" || tier === "DIRECT";
  return tier === "SAME" || tier === "DIRECT" || tier === "INDIRECT"; // ANY (default)
}

/** Level weight from evaluator vs subject numeric grade level: lower 1, same 2,
 *  higher 4. A missing grade on either side counts as **same (2)**. */
export function levelWeight(evaluatorLevel: number | null | undefined, subjectLevel: number | null | undefined): number {
  if (evaluatorLevel == null || subjectLevel == null) return 2;
  if (evaluatorLevel > subjectLevel) return 4;
  if (evaluatorLevel < subjectLevel) return 1;
  return 2;
}

/** Final vote weight = level × dept (1..16). */
export function voteWeight(level: number, dept: number): number {
  return level * dept;
}
