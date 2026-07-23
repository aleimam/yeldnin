import { describe, it, expect } from "vitest";
import {
  normalizeEdge,
  buildAdjacency,
  deptTier,
  deptWeight,
  canEvaluate,
  scopeAllows,
  levelWeight,
  voteWeight,
} from "./weighting-logic";

// Graph:  1 — 2 — 3 — 4   (5 is isolated)
const adj = buildAdjacency([
  [1, 2],
  [2, 3],
  [3, 4],
]);

describe("normalizeEdge", () => {
  it("orders the pair", () => {
    expect(normalizeEdge(5, 2)).toEqual([2, 5]);
    expect(normalizeEdge(2, 5)).toEqual([2, 5]);
  });
});

describe("deptTier", () => {
  it("same team", () => expect(deptTier([1], [1], adj)).toBe("SAME"));
  it("direct neighbour", () => expect(deptTier([1], [2], adj)).toBe("DIRECT"));
  it("indirect (2 hops)", () => expect(deptTier([1], [3], adj)).toBe("INDIRECT"));
  it("too far (3 hops) → none", () => expect(deptTier([1], [4], adj)).toBe("NONE"));
  it("isolated → none", () => expect(deptTier([1], [5], adj)).toBe("NONE"));
  it("multi-team takes the strongest link", () => {
    expect(deptTier([1, 3], [4], adj)).toBe("DIRECT"); // 3-4 direct beats 1-4 none
    expect(deptTier([1], [3, 5], adj)).toBe("INDIRECT"); // 1-3 indirect beats 1-5 none
    expect(deptTier([4], [4, 1], adj)).toBe("SAME"); // shares team 4
  });
});

describe("deptWeight + canEvaluate", () => {
  it("weights per tier", () => {
    expect(deptWeight("SAME")).toBe(4);
    expect(deptWeight("DIRECT")).toBe(2);
    expect(deptWeight("INDIRECT")).toBe(1);
    expect(deptWeight("NONE")).toBe(0);
  });
  it("can evaluate within 2 hops, not beyond", () => {
    expect(canEvaluate([1], [3], adj)).toBe(true);
    expect(canEvaluate([1], [4], adj)).toBe(false);
    expect(canEvaluate([1], [5], adj)).toBe(false);
  });
});

describe("scopeAllows", () => {
  it("ANY = same/direct/indirect", () => {
    expect(scopeAllows("ANY", "SAME")).toBe(true);
    expect(scopeAllows("ANY", "INDIRECT")).toBe(true);
    expect(scopeAllows("ANY", "NONE")).toBe(false);
  });
  it("CONNECTED = same/direct only", () => {
    expect(scopeAllows("CONNECTED", "DIRECT")).toBe(true);
    expect(scopeAllows("CONNECTED", "INDIRECT")).toBe(false);
  });
  it("SAME_DEPT = same only", () => {
    expect(scopeAllows("SAME_DEPT", "SAME")).toBe(true);
    expect(scopeAllows("SAME_DEPT", "DIRECT")).toBe(false);
  });
});

describe("levelWeight + voteWeight", () => {
  it("lower 1, same 2, higher 4", () => {
    expect(levelWeight(2, 5)).toBe(1); // evaluator lower
    expect(levelWeight(3, 3)).toBe(2); // same
    expect(levelWeight(6, 2)).toBe(4); // higher
  });
  it("missing grade → same (2)", () => {
    expect(levelWeight(null, 3)).toBe(2);
    expect(levelWeight(3, undefined)).toBe(2);
  });
  it("final vote weight = level × dept, tops at 16", () => {
    expect(voteWeight(4, 4)).toBe(16);
    expect(voteWeight(1, 1)).toBe(1);
    expect(voteWeight(levelWeight(6, 2), deptWeight("DIRECT"))).toBe(8);
  });
});
