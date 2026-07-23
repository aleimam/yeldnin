import "server-only";
import { prisma } from "@/lib/db";
import { buildAdjacency, deptTier } from "./weighting-logic";
import { visibleCriteria, criterionAppliesToSubject, parseIds } from "./eligibility-logic";

/** Resolve the signed-in user's employee id (null if they have no employee record). */
export async function myEmployeeId(userId: number): Promise<number | null> {
  const e = await prisma.employee.findUnique({ where: { userId }, select: { id: true } });
  return e?.id ?? null;
}

export interface EvaluateListItem {
  subjectEmpId: number;
  name: string;
  nameAr: string | null;
  deptLabel: string;
  status: string; // PENDING | SUBMITTED | NA
  isSelf: boolean;
}
export interface EvaluateList {
  cycle: { id: number; name: string; status: string; deadline: Date };
  items: EvaluateListItem[];
  done: number;
  total: number;
}

/** The people this evaluator must review in a cycle, with per-person status. */
export async function myEvaluateList(cycleId: number, evaluatorEmpId: number): Promise<EvaluateList | null> {
  const cycle = await prisma.evalCycle.findUnique({ where: { id: cycleId }, select: { id: true, name: true, status: true, deadline: true } });
  if (!cycle) return null;

  const evals = await prisma.evaluation.findMany({
    where: { cycleId, evaluatorEmpId },
    select: { subjectEmpId: true, status: true, isSelf: true },
  });
  const subjectIds = evals.map((e) => e.subjectEmpId);
  const emps = subjectIds.length
    ? await prisma.employee.findMany({
        where: { id: { in: subjectIds } },
        select: { id: true, user: { select: { name: true, nameAr: true, teamMembers: { select: { team: { select: { name: true } } } } } } },
      })
    : [];
  const empById = new Map(emps.map((e) => [e.id, e]));

  const items: EvaluateListItem[] = evals.map((e) => {
    const emp = empById.get(e.subjectEmpId);
    return {
      subjectEmpId: e.subjectEmpId,
      name: emp?.user.name ?? `#${e.subjectEmpId}`,
      nameAr: emp?.user.nameAr ?? null,
      deptLabel: emp?.user.teamMembers.map((m) => m.team.name).join(", ") ?? "",
      status: e.status,
      isSelf: e.isSelf,
    };
  });
  // Self first, then by name.
  items.sort((a, b) => (a.isSelf === b.isSelf ? a.name.localeCompare(b.name) : a.isSelf ? -1 : 1));

  const done = evals.filter((e) => e.status === "SUBMITTED" || e.status === "NA").length;
  return { cycle, items, done, total: evals.length };
}

export interface FormCriterion {
  criterionId: number;
  title: string;
  titleAr: string | null;
  text: string;
  textAr: string | null;
  level: number | null;
  note: string | null;
}
export interface FormPillar {
  pillarId: number;
  name: string;
  nameAr: string | null;
  criteria: FormCriterion[];
}
export interface EvaluationForm {
  cycle: { id: number; name: string; status: string; deadline: Date };
  evaluationId: number;
  status: string;
  isSelf: boolean;
  overallComment: string;
  subject: { empId: number; name: string; nameAr: string | null; deptLabel: string; avatarUrl: string | null };
  pillars: FormPillar[];
  editable: boolean;
  prevSubjectId: number | null;
  nextSubjectId: number | null;
}

/** Build the evaluate form for one (evaluator → subject) pair from the frozen
 *  cycle snapshot. Returns null if the assignment doesn't exist / isn't this
 *  evaluator's. Criteria are filtered by the subject's frozen departments and the
 *  pair's frozen relationship scope (self sees everything). */
export async function loadEvaluationForm(
  cycleId: number,
  evaluatorEmpId: number,
  subjectEmpId: number,
): Promise<EvaluationForm | null> {
  const evaluation = await prisma.evaluation.findUnique({
    where: { cycleId_evaluatorEmpId_subjectEmpId: { cycleId, evaluatorEmpId, subjectEmpId } },
    include: { answers: true },
  });
  if (!evaluation) return null;
  const cycle = await prisma.evalCycle.findUnique({ where: { id: cycleId }, select: { id: true, name: true, status: true, deadline: true } });
  if (!cycle) return null;

  const [evaluator, subject] = await Promise.all([
    prisma.evalCycleParticipant.findUnique({ where: { cycleId_empId: { cycleId, empId: evaluatorEmpId } } }),
    prisma.evalCycleParticipant.findUnique({ where: { cycleId_empId: { cycleId, empId: subjectEmpId } } }),
  ]);
  const subjectTeams = subject ? parseIds(subject.teamIds) : [];
  const evaluatorTeams = evaluator ? parseIds(evaluator.teamIds) : [];

  const edges = await prisma.evalCycleEdge.findMany({ where: { cycleId } });
  const adj = buildAdjacency(edges.map((e) => [e.aId, e.bId]));
  const tier = deptTier(evaluatorTeams, subjectTeams, adj);

  const frozen = await prisma.evalCycleCriterion.findMany({
    where: { cycleId },
    orderBy: [{ pillarOrder: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
  });
  // dept applicability, then scope visibility (self sees all).
  const applicable = frozen.filter((c) => criterionAppliesToSubject(parseIds(c.teamIds), subjectTeams));
  const visible = visibleCriteria(applicable, tier, evaluation.isSelf);

  const ansByCrit = new Map(evaluation.answers.map((a) => [a.criterionId, a]));
  const pillarMap = new Map<number, FormPillar>();
  for (const c of visible) {
    let p = pillarMap.get(c.pillarId);
    if (!p) {
      p = { pillarId: c.pillarId, name: c.pillarName, nameAr: c.pillarNameAr, criteria: [] };
      pillarMap.set(c.pillarId, p);
    }
    const a = ansByCrit.get(c.criterionId);
    p.criteria.push({
      criterionId: c.criterionId,
      title: c.title,
      titleAr: c.titleAr,
      text: c.text,
      textAr: c.textAr,
      level: a?.level ?? null,
      note: a?.note ?? null,
    });
  }

  // Subject display + prev/next nav within this evaluator's list (self first, then by name).
  const [subjEmp, siblings] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: subjectEmpId },
      select: { user: { select: { name: true, nameAr: true, avatarUrl: true, teamMembers: { select: { team: { select: { name: true } } } } } } },
    }),
    prisma.evaluation.findMany({
      where: { cycleId, evaluatorEmpId },
      select: { subjectEmpId: true, isSelf: true },
    }),
  ]);
  // Order siblings the same way the list does (need names).
  const sibIds = siblings.map((s) => s.subjectEmpId);
  const sibEmps = await prisma.employee.findMany({ where: { id: { in: sibIds } }, select: { id: true, user: { select: { name: true } } } });
  const nameById = new Map(sibEmps.map((e) => [e.id, e.user.name]));
  const ordered = [...siblings].sort((a, b) => {
    if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
    return (nameById.get(a.subjectEmpId) ?? "").localeCompare(nameById.get(b.subjectEmpId) ?? "");
  });
  const idx = ordered.findIndex((s) => s.subjectEmpId === subjectEmpId);
  const prevSubjectId = idx > 0 ? ordered[idx - 1].subjectEmpId : null;
  const nextSubjectId = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1].subjectEmpId : null;

  const editable = cycle.status === "OPEN" && new Date() <= cycle.deadline;

  return {
    cycle,
    evaluationId: evaluation.id,
    status: evaluation.status,
    isSelf: evaluation.isSelf,
    overallComment: evaluation.overallComment ?? "",
    subject: {
      empId: subjectEmpId,
      name: subjEmp?.user.name ?? `#${subjectEmpId}`,
      nameAr: subjEmp?.user.nameAr ?? null,
      deptLabel: subjEmp?.user.teamMembers.map((m) => m.team.name).join(", ") ?? "",
      avatarUrl: subjEmp?.user.avatarUrl ?? null,
    },
    pillars: [...pillarMap.values()],
    editable,
    prevSubjectId,
    nextSubjectId,
  };
}

interface AnswerInput {
  criterionId: number;
  level: number | null;
  note: string | null;
}

/** Guard: the evaluation belongs to this evaluator and its cycle is still editable. */
async function loadEditable(evaluationId: number, evaluatorEmpId: number) {
  const ev = await prisma.evaluation.findUnique({ where: { id: evaluationId }, select: { id: true, evaluatorEmpId: true, isSelf: true, cycleId: true } });
  if (!ev || ev.evaluatorEmpId !== evaluatorEmpId) throw new Error("Not your evaluation.");
  const cycle = await prisma.evalCycle.findUnique({ where: { id: ev.cycleId }, select: { status: true, deadline: true } });
  if (!cycle || cycle.status !== "OPEN" || new Date() > cycle.deadline) throw new Error("This cycle is closed.");
  return ev;
}

/** Autosave answers + overall comment. A person is "Done" (SUBMITTED) once the
 *  overall comment is non-empty; otherwise PENDING. Answers are optional. */
export async function saveEvaluation(
  evaluationId: number,
  evaluatorEmpId: number,
  input: { overallComment: string; answers: AnswerInput[] },
): Promise<void> {
  await loadEditable(evaluationId, evaluatorEmpId);
  const comment = input.overallComment.trim();
  const status = comment ? "SUBMITTED" : "PENDING";

  await prisma.$transaction(async (tx) => {
    for (const a of input.answers) {
      const lvl = Number(a.level);
      const note = a.note?.trim() ? a.note.trim() : null;
      if (Number.isInteger(lvl) && lvl >= 1 && lvl <= 5) {
        await tx.evalAnswer.upsert({
          where: { evaluationId_criterionId: { evaluationId, criterionId: a.criterionId } },
          create: { evaluationId, criterionId: a.criterionId, level: lvl, note },
          update: { level: lvl, note },
        });
      } else {
        // cleared → remove any stored answer
        await tx.evalAnswer.deleteMany({ where: { evaluationId, criterionId: a.criterionId } });
      }
    }
    await tx.evaluation.update({
      where: { id: evaluationId },
      data: { overallComment: comment || null, status, submittedAt: status === "SUBMITTED" ? new Date() : null },
    });
  });
}

/** Toggle "can't evaluate this person" (N/A). Not allowed for a self-evaluation. */
export async function setNotApplicable(evaluationId: number, evaluatorEmpId: number, na: boolean): Promise<void> {
  const ev = await loadEditable(evaluationId, evaluatorEmpId);
  if (ev.isSelf && na) throw new Error("You cannot mark your own self-evaluation N/A.");
  if (na) {
    await prisma.evaluation.update({ where: { id: evaluationId }, data: { status: "NA", submittedAt: new Date() } });
  } else {
    // reverting: Done if a comment already exists, else back to pending
    const cur = await prisma.evaluation.findUnique({ where: { id: evaluationId }, select: { overallComment: true } });
    const done = !!cur?.overallComment?.trim();
    await prisma.evaluation.update({
      where: { id: evaluationId },
      data: { status: done ? "SUBMITTED" : "PENDING", submittedAt: done ? new Date() : null },
    });
  }
}
