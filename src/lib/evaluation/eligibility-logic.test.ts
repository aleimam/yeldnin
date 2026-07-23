import { describe, it, expect } from "vitest";
import { buildAdjacency } from "./weighting-logic";
import {
  assignmentPairs,
  pairTier,
  visibleCriteria,
  criterionAppliesToSubject,
  parseIds,
  serializeIds,
  evaluatorComplete,
  type Participant,
} from "./eligibility-logic";

// Graph: sales(1)—purchasing(3)—logistics(4). sales↔purchasing direct,
// purchasing↔logistics direct, sales↔logistics indirect (2 hops via purchasing).
const EDGES: Array<[number, number]> = [
  [1, 3],
  [3, 4],
];

const P = (empId: number, teams: number[], grade: number | null = null): Participant => ({ empId, teams, grade });

describe("assignmentPairs", () => {
  it("always includes a self-evaluation for every participant", () => {
    const people = [P(10, [1]), P(20, [3])];
    const pairs = assignmentPairs(people, EDGES);
    expect(pairs.filter((x) => x.isSelf).map((x) => x.evaluatorEmpId).sort()).toEqual([10, 20]);
    for (const s of pairs.filter((x) => x.isSelf)) expect(s.evaluatorEmpId).toBe(s.subjectEmpId);
  });

  it("links people across connected departments (direct + indirect), skips unconnected", () => {
    const sales = P(10, [1]);
    const purchasing = P(20, [3]);
    const logistics = P(30, [4]);
    const island = P(40, [99]); // unconnected department
    const pairs = assignmentPairs([sales, purchasing, logistics, island], EDGES);
    const nonSelf = pairs.filter((x) => !x.isSelf);
    // sales↔purchasing (direct), purchasing↔logistics (direct), sales↔logistics (indirect) — both directions
    const has = (a: number, b: number) => nonSelf.some((x) => x.evaluatorEmpId === a && x.subjectEmpId === b);
    expect(has(10, 20)).toBe(true);
    expect(has(20, 10)).toBe(true);
    expect(has(10, 30)).toBe(true); // indirect still eligible
    expect(has(30, 10)).toBe(true);
    // island reaches no one and no one reaches it
    expect(nonSelf.some((x) => x.evaluatorEmpId === 40 || x.subjectEmpId === 40)).toBe(false);
  });

  it("same-department peers evaluate each other", () => {
    const pairs = assignmentPairs([P(1, [1]), P(2, [1])], EDGES).filter((x) => !x.isSelf);
    expect(pairs).toHaveLength(2);
  });
});

describe("pairTier", () => {
  const adj = buildAdjacency(EDGES);
  it("classifies same / direct / indirect / none", () => {
    expect(pairTier(P(1, [1]), P(2, [1]), adj)).toBe("SAME");
    expect(pairTier(P(1, [1]), P(2, [3]), adj)).toBe("DIRECT");
    expect(pairTier(P(1, [1]), P(2, [4]), adj)).toBe("INDIRECT");
    expect(pairTier(P(1, [1]), P(2, [99]), adj)).toBe("NONE");
  });
});

describe("visibleCriteria", () => {
  const crits = [{ raterScope: "ANY" }, { raterScope: "CONNECTED" }, { raterScope: "SAME_DEPT" }];
  it("self sees every criterion regardless of tier", () => {
    expect(visibleCriteria(crits, "NONE", true)).toHaveLength(3);
  });
  it("SAME tier sees all three scopes", () => {
    expect(visibleCriteria(crits, "SAME", false).map((c) => c.raterScope)).toEqual(["ANY", "CONNECTED", "SAME_DEPT"]);
  });
  it("DIRECT tier drops SAME_DEPT-only criteria", () => {
    expect(visibleCriteria(crits, "DIRECT", false).map((c) => c.raterScope)).toEqual(["ANY", "CONNECTED"]);
  });
  it("INDIRECT tier keeps only ANY criteria", () => {
    expect(visibleCriteria(crits, "INDIRECT", false).map((c) => c.raterScope)).toEqual(["ANY"]);
  });
});

describe("criterionAppliesToSubject", () => {
  it("empty applicability applies to everyone", () => {
    expect(criterionAppliesToSubject([], [1])).toBe(true);
    expect(criterionAppliesToSubject([], [])).toBe(true);
  });
  it("applies when the subject is in any listed department", () => {
    expect(criterionAppliesToSubject([3, 4], [1, 3])).toBe(true);
    expect(criterionAppliesToSubject([3, 4], [1])).toBe(false);
  });
});

describe("id CSV round-trip", () => {
  it("serializes and parses, dropping blanks + dedup", () => {
    expect(serializeIds([1, 2, 2, 3])).toBe("1,2,3");
    expect(parseIds("1,2,3")).toEqual([1, 2, 3]);
    expect(parseIds("")).toEqual([]);
    expect(parseIds("1, ,3")).toEqual([1, 3]);
  });
});

describe("evaluatorComplete", () => {
  it("is complete only when every assignment is submitted or N/A", () => {
    expect(evaluatorComplete(["SUBMITTED", "NA", "SUBMITTED"])).toBe(true);
    expect(evaluatorComplete(["SUBMITTED", "PENDING"])).toBe(false);
    expect(evaluatorComplete([])).toBe(true);
  });
});
