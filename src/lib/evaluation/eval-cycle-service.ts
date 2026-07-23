import "server-only";
import { prisma } from "@/lib/db";
import { nextUid } from "@/lib/uid";
import { assignmentPairs, serializeIds, type Participant } from "./eligibility-logic";
import { materializeCycle } from "./scoring-service";

export interface NewCycleInput {
  name: string;
  deadline: string; // ISO / yyyy-mm-dd
  teamIds: number[];
  effortWeight?: number;
}

/** The single currently-open cycle, or null. */
export async function getOpenCycle() {
  return prisma.evalCycle.findFirst({ where: { status: "OPEN" }, orderBy: { id: "desc" } });
}

export interface CycleRow {
  id: number;
  uid: string;
  name: string;
  status: string;
  deadline: Date;
  startedAt: Date;
  closedAt: Date | null;
  teamCount: number;
  participantCount: number;
}

export async function listCycles(): Promise<CycleRow[]> {
  const cycles = await prisma.evalCycle.findMany({
    orderBy: { id: "desc" },
    include: { _count: { select: { teams: true } } },
  });
  // participant counts in one grouped query
  const counts = await prisma.evalCycleParticipant.groupBy({ by: ["cycleId"], _count: { empId: true } });
  const partByCycle = new Map(counts.map((c) => [c.cycleId, c._count.empId]));
  return cycles.map((c) => ({
    id: c.id,
    uid: c.uid,
    name: c.name,
    status: c.status,
    deadline: c.deadline,
    startedAt: c.startedAt,
    closedAt: c.closedAt,
    teamCount: c._count.teams,
    participantCount: partByCycle.get(c.id) ?? 0,
  }));
}

/**
 * Open a new review cycle: validate (one open at a time), resolve the staff
 * participants in the included departments, FREEZE the criteria set + each
 * participant's departments/grade + the connection graph, and generate every
 * (evaluator → subject) assignment incl. self. EVALUATION.md §7.
 */
export async function createCycle(input: NewCycleInput, createdById: number | null): Promise<number> {
  const name = input.name.trim();
  if (!name) throw new Error("Cycle name is required.");
  if (!input.teamIds.length) throw new Error("Select at least one department.");
  const deadline = new Date(input.deadline);
  if (Number.isNaN(deadline.getTime())) throw new Error("A valid deadline is required.");
  if ((await getOpenCycle()) !== null) throw new Error("A review cycle is already open. Close it before opening another.");

  const effortWeight = Math.min(100, Math.max(0, Math.round(input.effortWeight ?? 15)));
  const teamSet = new Set(input.teamIds);

  // Participants: staff (payroll-eligible employee type), not archived, member of
  // ≥1 included department (via their user's team memberships).
  const emps = await prisma.employee.findMany({
    where: { archivedAt: null, employeeType: { payrollEligible: true } },
    select: {
      id: true,
      position: { select: { gradeLevel: true } },
      user: { select: { teamMembers: { select: { teamId: true } } } },
    },
  });
  const participants: Participant[] = emps
    .map((e) => ({ empId: e.id, grade: e.position?.gradeLevel ?? null, teams: e.user.teamMembers.map((m) => m.teamId) }))
    .filter((p) => p.teams.some((t) => teamSet.has(t)));
  if (participants.length < 2) throw new Error("Not enough staff in the selected departments to run a cycle.");

  // Frozen criteria (active pillars/criteria + applicability).
  const pillars = await prisma.evalPillar.findMany({
    where: { archivedAt: null },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: {
      teams: { select: { teamId: true } },
      criteria: { where: { archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
    },
  });

  // Frozen connection graph.
  const edgeRows = await prisma.teamConnection.findMany();
  const edges: Array<[number, number]> = edgeRows.map((e) => [e.aId, e.bId]);

  const pairs = assignmentPairs(participants, edges);
  const uid = await nextUid("EVC");

  return prisma.$transaction(
    async (tx) => {
      const cycle = await tx.evalCycle.create({
        data: { uid, name, deadline, effortWeight, createdById, status: "OPEN" },
      });
      await tx.evalCycleTeam.createMany({ data: input.teamIds.map((teamId) => ({ cycleId: cycle.id, teamId })) });
      await tx.evalCycleParticipant.createMany({
        data: participants.map((p) => ({ cycleId: cycle.id, empId: p.empId, grade: p.grade, teamIds: serializeIds(p.teams) })),
      });
      const critRows = pillars.flatMap((pl) =>
        pl.criteria.map((c) => ({
          cycleId: cycle.id,
          criterionId: c.id,
          pillarId: pl.id,
          pillarName: pl.name,
          pillarNameAr: pl.nameAr,
          pillarOrder: pl.sortOrder,
          title: c.title,
          titleAr: c.titleAr,
          text: c.text,
          textAr: c.textAr,
          raterScope: c.raterScope,
          sortOrder: c.sortOrder,
          teamIds: serializeIds(pl.teams.map((t) => t.teamId)),
        })),
      );
      if (critRows.length) await tx.evalCycleCriterion.createMany({ data: critRows });
      if (edgeRows.length) await tx.evalCycleEdge.createMany({ data: edgeRows.map((e) => ({ cycleId: cycle.id, aId: e.aId, bId: e.bId })) });
      await tx.evaluation.createMany({
        data: pairs.map((p) => ({ cycleId: cycle.id, evaluatorEmpId: p.evaluatorEmpId, subjectEmpId: p.subjectEmpId, isSelf: p.isSelf })),
      });
      return cycle.id;
    },
    { timeout: 30000 },
  );
}

export async function extendDeadline(cycleId: number, deadline: string): Promise<void> {
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) throw new Error("A valid deadline is required.");
  const cycle = await prisma.evalCycle.findUnique({ where: { id: cycleId } });
  if (!cycle || cycle.status !== "OPEN") throw new Error("Only an open cycle's deadline can be changed.");
  await prisma.evalCycle.update({ where: { id: cycleId }, data: { deadline: d } });
}

/** Close a cycle: materialize the frozen scores into EvalResult, then flip status. */
export async function closeCycle(cycleId: number): Promise<void> {
  const cycle = await prisma.evalCycle.findUnique({ where: { id: cycleId } });
  if (!cycle || cycle.status !== "OPEN") throw new Error("Cycle is not open.");
  await materializeCycle(cycleId);
  await prisma.evalCycle.update({ where: { id: cycleId }, data: { status: "CLOSED", closedAt: new Date() } });
}

/** Re-run scoring for an already-closed cycle (e.g. after data corrections). */
export async function recomputeCycle(cycleId: number): Promise<void> {
  const cycle = await prisma.evalCycle.findUnique({ where: { id: cycleId } });
  if (!cycle) throw new Error("Cycle not found.");
  await materializeCycle(cycleId);
}

export interface DashboardRow {
  empId: number;
  name: string;
  nameAr: string | null;
  teams: string;
  total: number;
  done: number;
  complete: boolean;
}
export interface CycleDashboard {
  cycle: { id: number; uid: string; name: string; status: string; deadline: Date; startedAt: Date; closedAt: Date | null; effortWeight: number };
  teamNames: string[];
  rows: DashboardRow[];
  completeCount: number;
}

/** Per-participant completion dashboard (each evaluator's done / total). */
export async function getCycleDashboard(cycleId: number): Promise<CycleDashboard | null> {
  const cycle = await prisma.evalCycle.findUnique({ where: { id: cycleId }, include: { teams: true } });
  if (!cycle) return null;

  const evals = await prisma.evaluation.findMany({ where: { cycleId }, select: { evaluatorEmpId: true, status: true } });
  const byEval = new Map<number, { total: number; done: number }>();
  for (const e of evals) {
    const g = byEval.get(e.evaluatorEmpId) ?? { total: 0, done: 0 };
    g.total++;
    if (e.status === "SUBMITTED" || e.status === "NA") g.done++;
    byEval.set(e.evaluatorEmpId, g);
  }

  const empIds = [...byEval.keys()];
  const emps = empIds.length
    ? await prisma.employee.findMany({
        where: { id: { in: empIds } },
        select: { id: true, user: { select: { name: true, nameAr: true, teamMembers: { select: { team: { select: { name: true } } } } } } },
      })
    : [];
  const teamNamesById = new Map<number, string>();
  const teamIds = cycle.teams.map((t) => t.teamId);
  if (teamIds.length) {
    for (const t of await prisma.team.findMany({ where: { id: { in: teamIds } }, select: { id: true, name: true } })) teamNamesById.set(t.id, t.name);
  }

  const rows: DashboardRow[] = emps.map((e) => {
    const g = byEval.get(e.id) ?? { total: 0, done: 0 };
    return {
      empId: e.id,
      name: e.user.name,
      nameAr: e.user.nameAr,
      teams: e.user.teamMembers.map((m) => m.team.name).join(", "),
      total: g.total,
      done: g.done,
      complete: g.total > 0 && g.done === g.total,
    };
  });
  rows.sort((a, b) => a.name.localeCompare(b.name));

  return {
    cycle: {
      id: cycle.id,
      uid: cycle.uid,
      name: cycle.name,
      status: cycle.status,
      deadline: cycle.deadline,
      startedAt: cycle.startedAt,
      closedAt: cycle.closedAt,
      effortWeight: cycle.effortWeight,
    },
    teamNames: teamIds.map((id) => teamNamesById.get(id) ?? "").filter(Boolean),
    rows,
    completeCount: rows.filter((r) => r.complete).length,
  };
}
