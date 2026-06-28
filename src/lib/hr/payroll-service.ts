import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { clean } from "@/lib/text";
import { nextUid } from "@/lib/uid";
import { countWorkingDays, parseWeeklyOff, expandHolidayKeys } from "./attendance-logic";
import { round2 } from "./salary-logic";
import {
  dayOfBasic,
  dayOfTotalValue,
  resolveLineAmount,
  rollupTotals,
  prevMonth,
  isManualSource,
  ABSENCE_PENALTY_DAYS,
} from "./payroll-logic";

const monthStart = (y: number, m: number) => new Date(Date.UTC(y, m - 1, 1));
const monthEnd = (y: number, m: number) => new Date(Date.UTC(y, m, 0, 23, 59, 59));

interface BuildLine {
  kind: string; // EARNING | BONUS | PENALTY
  source: string; // STRUCTURE | DUTY | TARGET | ABSENCE | ADHOC | ENGAGEMENT
  componentId: number | null;
  label: string;
  valuation: string | null;
  qty: number | null;
  rate: number | null;
  detail: string | null;
}

/** Map a structure component + figure to a penalty line spec (days vs fixed). */
function penaltySpec(valuation: string, amount: number): { valuation: string; qty: number | null; rate: number | null } {
  if (valuation === "DAYS_OF_TOTAL" || valuation === "DAYS_OF_BASIC") return { valuation, qty: amount, rate: 1 };
  return { valuation: "FIXED_EVENT", qty: null, rate: amount };
}

// Config + holidays are identical for every employee in a payroll run, so memoize
// them per request — a company-wide run then fetches each once instead of N times.
const reqHrConfig = cache(() => prisma.hrConfig.findFirst({ orderBy: { id: "asc" } }));
const reqHolidayRanges = cache(() => prisma.holiday.findMany({ where: { archivedAt: null }, select: { startDate: true, endDate: true } }));

// ── Build the auto-derived lines for a slip (no persistence) ─────────────────
async function buildAutoLines(employeeId: number, year: number, month: number) {
  const [structure, cfg, holidayRanges] = await Promise.all([
    prisma.salaryStructureLine.findMany({ where: { employeeId, active: true }, include: { component: true } }),
    reqHrConfig(),
    reqHolidayRanges(),
  ]);
  const weeklyOff = parseWeeklyOff(cfg?.weeklyOffDays ?? "5");
  const holidayKeys = expandHolidayKeys(holidayRanges);
  const workingDays = countWorkingDays(monthStart(year, month), monthEnd(year, month), weeklyOff, holidayKeys);
  const basic = structure.find((l) => l.component.code === "BASIC")?.amount ?? 0;

  const lines: BuildLine[] = [];

  // Earnings (current month M): fixed-monthly earnings (basic + allowances).
  for (const l of structure.filter((s) => s.component.kind === "EARNING" && s.component.valuation === "FIXED_MONTHLY")) {
    lines.push({ kind: "EARNING", source: "STRUCTURE", componentId: l.componentId, label: l.component.name, valuation: "FIXED_MONTHLY", qty: null, rate: l.amount, detail: null });
  }

  // Duty bonuses (previous month M−1): DutyDay → DayType.bonusComponentId → structure line.
  const prev = prevMonth(year, month);
  const duties = await prisma.dutyDay.findMany({ where: { employeeId, date: { gte: monthStart(prev.year, prev.month), lte: monthEnd(prev.year, prev.month) } }, select: { dayTypeId: true } });
  if (duties.length) {
    const dtIds = [...new Set(duties.map((d) => d.dayTypeId))];
    const dts = await prisma.dayType.findMany({ where: { id: { in: dtIds } }, select: { id: true, bonusComponentId: true } });
    const dtBonus = new Map(dts.map((d) => [d.id, d.bonusComponentId]));
    const count = new Map<number, number>();
    for (const d of duties) {
      const cid = dtBonus.get(d.dayTypeId);
      if (cid) count.set(cid, (count.get(cid) ?? 0) + 1);
    }
    const bonusByComp = new Map(structure.filter((s) => s.component.kind === "BONUS").map((s) => [s.componentId, s]));
    for (const [componentId, n] of count) {
      const sline = bonusByComp.get(componentId);
      if (!sline) continue; // employee not priced for this bonus
      lines.push({ kind: "BONUS", source: "DUTY", componentId, label: sline.component.name, valuation: sline.component.valuation, qty: n, rate: sline.amount, detail: `${n} day(s) × ${sline.amount}` });
    }
  }

  // Engagement bonuses (current month M): every criterion this employee achieved
  // in an event whose pay-month is M pays its fixed bonus. Frozen when M's payslip
  // locks (the line stores the amount); recomputed live for drafts.
  const achievements = await prisma.engagementAchievement.findMany({
    where: { employeeId, event: { year, month, archivedAt: null } },
    select: { criterion: { select: { name: true, bonusAmount: true } }, event: { select: { title: true, template: { select: { name: true } } } } },
  });
  for (const a of achievements) {
    lines.push({ kind: "BONUS", source: "ENGAGEMENT", componentId: null, label: a.criterion.name, valuation: "FIXED_EVENT", qty: null, rate: a.criterion.bonusAmount, detail: a.event.title || a.event.template.name });
  }

  // Structure penalties (current month M): recurring deductions, if any.
  for (const l of structure.filter((s) => s.component.kind === "PENALTY")) {
    const spec = penaltySpec(l.component.valuation, l.amount);
    lines.push({ kind: "PENALTY", source: "STRUCTURE", componentId: l.componentId, label: l.component.name, valuation: spec.valuation, qty: spec.qty, rate: spec.rate, detail: null });
  }

  // Over-limit absences (current month M): each = 2 days of total salary.
  const absentOverLimit = await prisma.absence.count({ where: { employeeId, coveredByUrgent: false, date: { gte: monthStart(year, month), lte: monthEnd(year, month) } } });
  if (absentOverLimit > 0) {
    lines.push({ kind: "PENALTY", source: "ABSENCE", componentId: null, label: "Over-limit absences", valuation: "DAYS_OF_TOTAL", qty: absentOverLimit * ABSENCE_PENALTY_DAYS, rate: 1, detail: `${absentOverLimit} × ${ABSENCE_PENALTY_DAYS} days of total` });
  }

  return { lines, basic, workingDays, absentOverLimit };
}

/** Two-pass resolve: earnings/bonuses → gross → dayOfTotal → penalties. */
function computeAmounts(lines: BuildLine[], basic: number, workingDays: number) {
  const dob = dayOfBasic(basic);
  const resolved = lines.map((l) => ({ ...l, amount: l.kind === "PENALTY" ? 0 : resolveLineAmount(l, { dayOfBasic: dob, dayOfTotal: 0 }) }));
  const gross = round2(resolved.filter((l) => l.kind !== "PENALTY").reduce((s, l) => s + l.amount, 0));
  const dot = dayOfTotalValue(gross, workingDays);
  for (const l of resolved) if (l.kind === "PENALTY") l.amount = resolveLineAmount(l, { dayOfBasic: dob, dayOfTotal: dot });
  const totals = rollupTotals(resolved);
  return { resolved, totals, dob, dot };
}

// ── Recompute a draft: regenerate auto lines, preserve manual, refresh totals ─
async function recomputeInner(payslipId: number) {
  const slip = await prisma.payslip.findUnique({ where: { id: payslipId }, include: { lines: true } });
  if (!slip) throw new Error("Payslip not found.");
  if (slip.status === "LOCKED") throw new Error("This payslip is locked.");

  const manual: BuildLine[] = slip.lines
    .filter((l) => isManualSource(l.source))
    .map((l) => ({ kind: l.kind, source: l.source, componentId: l.componentId, label: l.label, valuation: l.valuation, qty: l.qty, rate: l.rate, detail: l.detail }));
  const auto = await buildAutoLines(slip.employeeId, slip.year, slip.month);
  const all = [...auto.lines, ...manual];
  const { resolved, totals, dob, dot } = computeAmounts(all, auto.basic, auto.workingDays);

  // Atomic: clearing the old lines, writing the new ones, and refreshing the
  // header must all land together — a mid-fail must never leave a payslip with
  // zero lines or totals that disagree with its lines.
  await prisma.$transaction([
    prisma.payslipLine.deleteMany({ where: { payslipId } }),
    prisma.payslipLine.createMany({
      data: resolved.map((l) => ({ payslipId, kind: l.kind, source: l.source, componentId: l.componentId, label: l.label, valuation: l.valuation, qty: l.qty, rate: l.rate, amount: l.amount, detail: l.detail })),
    }),
    prisma.payslip.update({
      where: { id: payslipId },
      data: { basic: auto.basic, earningsTotal: totals.earningsTotal, bonusTotal: totals.bonusTotal, penaltyTotal: totals.penaltyTotal, gross: totals.gross, net: totals.net, workingDays: auto.workingDays, dayOfBasic: dob, dayOfTotal: dot, absentOverLimit: auto.absentOverLimit },
    }),
  ]);
  return prisma.payslip.findUnique({ where: { id: payslipId }, include: { lines: true } });
}

// ── Public API ───────────────────────────────────────────────────────────────
/** Create the draft for (employee, year, month) if absent, then (re)compute it. */
export async function generateDraft(employeeId: number, year: number, month: number, userId: number) {
  const existing = await prisma.payslip.findUnique({ where: { employeeId_year_month: { employeeId, year, month } }, select: { id: true, status: true } });
  if (existing) {
    if (existing.status === "LOCKED") throw new Error("A locked payslip already exists for this month.");
    return recomputeInner(existing.id);
  }
  let slip;
  try {
    slip = await prisma.payslip.create({ data: { employeeId, year, month, generatedById: userId } });
  } catch {
    // A concurrent generate won the unique (employee, year, month) race (P2002) —
    // fall back to the slip that now exists instead of surfacing a raw DB error.
    const dup = await prisma.payslip.findUnique({ where: { employeeId_year_month: { employeeId, year, month } }, select: { id: true, status: true } });
    if (!dup) throw new Error("Could not generate the payslip.");
    if (dup.status === "LOCKED") throw new Error("A locked payslip already exists for this month.");
    return recomputeInner(dup.id);
  }
  return recomputeInner(slip.id);
}

export async function recompute(payslipId: number) {
  return recomputeInner(payslipId);
}

/** Add a target bonus (manual): pays the employee's structure figure for it. */
export async function addTargetLine(payslipId: number, componentId: number) {
  const slip = await prisma.payslip.findUnique({ where: { id: payslipId }, select: { id: true, employeeId: true, status: true } });
  if (!slip) throw new Error("Payslip not found.");
  if (slip.status === "LOCKED") throw new Error("This payslip is locked.");
  const sline = await prisma.salaryStructureLine.findUnique({ where: { employeeId_componentId: { employeeId: slip.employeeId, componentId } }, include: { component: true } });
  if (!sline || sline.component.kind !== "BONUS") throw new Error("Not a bonus component for this employee.");
  const dup = await prisma.payslipLine.findFirst({ where: { payslipId, source: "TARGET", componentId } });
  if (dup) throw new Error("That target bonus is already on this payslip.");
  await prisma.payslipLine.create({ data: { payslipId, kind: "BONUS", source: "TARGET", componentId, label: sline.component.name, valuation: "FIXED_EVENT", qty: null, rate: sline.amount, amount: 0 } });
  return recomputeInner(payslipId);
}

export interface AdhocInput {
  kind: "BONUS" | "PENALTY";
  mode: "FIXED" | "DAYS"; // DAYS → days-of-basic (bonus) | days-of-total (penalty)
  label: string;
  amount?: number | null; // for FIXED
  days?: number | null; // for DAYS
}

export async function addAdhocLine(payslipId: number, input: AdhocInput) {
  const slip = await prisma.payslip.findUnique({ where: { id: payslipId }, select: { id: true, status: true } });
  if (!slip) throw new Error("Payslip not found.");
  if (slip.status === "LOCKED") throw new Error("This payslip is locked.");
  let valuation: string, qty: number | null, rate: number | null;
  if (input.mode === "DAYS") {
    valuation = input.kind === "BONUS" ? "DAYS_OF_BASIC" : "DAYS_OF_TOTAL";
    qty = input.days ?? 0;
    rate = 1;
  } else {
    valuation = "FIXED_EVENT";
    qty = null;
    rate = input.amount ?? 0;
  }
  await prisma.payslipLine.create({ data: { payslipId, kind: input.kind, source: "ADHOC", componentId: null, label: clean(input.label) ?? (input.kind === "BONUS" ? "Bonus" : "Penalty"), valuation, qty, rate, amount: 0 } });
  return recomputeInner(payslipId);
}

/** Remove a manual line (TARGET/ADHOC only). */
export async function removeLine(payslipId: number, lineId: number) {
  const slip = await prisma.payslip.findUnique({ where: { id: payslipId }, select: { status: true } });
  if (!slip) throw new Error("Payslip not found.");
  if (slip.status === "LOCKED") throw new Error("This payslip is locked.");
  const line = await prisma.payslipLine.findFirst({ where: { id: lineId, payslipId }, select: { source: true } });
  if (!line || !isManualSource(line.source)) throw new Error("Only manually-added lines can be removed.");
  await prisma.payslipLine.delete({ where: { id: lineId } });
  return recomputeInner(payslipId);
}

/** Finalize: recompute once more, then freeze as immutable history. */
export async function lockPayslip(payslipId: number, userId: number) {
  const fresh = await recomputeInner(payslipId);
  if (!fresh) throw new Error("Payslip not found.");
  const uid = await nextUid("PS");
  // Lock + audit event together — a locked payslip must always have its event.
  await prisma.$transaction([
    prisma.payslip.update({ where: { id: payslipId }, data: { status: "LOCKED", lockedById: userId, lockedAt: new Date(), uid } }),
    prisma.employeeEvent.create({ data: { employeeId: fresh.employeeId, type: "PROFILE_EDIT", message: `Payslip ${fresh.year}-${String(fresh.month).padStart(2, "0")} finalized: net ${fresh.net.toFixed(2)}.`, byUserId: userId } }),
  ]);
  return prisma.payslip.findUnique({ where: { id: payslipId }, include: { lines: true } });
}

// ── Reads ────────────────────────────────────────────────────────────────────
/** The employee a payslip belongs to — the authoritative owner for authz checks. */
export async function payslipEmployeeId(payslipId: number): Promise<number | null> {
  const slip = await prisma.payslip.findUnique({ where: { id: payslipId }, select: { employeeId: true } });
  return slip?.employeeId ?? null;
}

export function listPayslips(employeeId: number) {
  return prisma.payslip.findMany({ where: { employeeId }, orderBy: [{ year: "desc" }, { month: "desc" }] });
}

export async function getPayslip(payslipId: number) {
  const slip = await prisma.payslip.findUnique({ where: { id: payslipId }, include: { lines: true } });
  if (!slip) return null;
  slip.lines.sort((a, b) => kindOrder(a.kind) - kindOrder(b.kind) || a.id - b.id);
  return slip;
}
function kindOrder(k: string) {
  return k === "EARNING" ? 0 : k === "BONUS" ? 1 : 2;
}

/** Target bonus components the employee has but hasn't yet added to this slip. */
export async function eligibleTargets(payslipId: number, employeeId: number) {
  const added = (await prisma.payslipLine.findMany({ where: { payslipId, source: "TARGET" }, select: { componentId: true } })).map((l) => l.componentId);
  const lines = await prisma.salaryStructureLine.findMany({ where: { employeeId, active: true, componentId: { notIn: added.filter((x): x is number => x != null) } }, include: { component: true } });
  return lines.filter((l) => l.component.kind === "BONUS" && l.component.valuation === "FIXED_EVENT").map((l) => ({ componentId: l.componentId, name: l.component.name, amount: l.amount }));
}

/** Manage view: all payslips with lines + eligible target bonuses per draft. */
export async function payrollForEmployee(employeeId: number) {
  const slips = await prisma.payslip.findMany({ where: { employeeId }, orderBy: [{ year: "desc" }, { month: "desc" }], include: { lines: true } });
  for (const s of slips) s.lines.sort((a, b) => kindOrder(a.kind) - kindOrder(b.kind) || a.id - b.id);
  const targets: Record<number, { componentId: number; name: string; amount: number }[]> = {};
  for (const s of slips) if (s.status === "DRAFT") targets[s.id] = await eligibleTargets(s.id, employeeId);
  return { slips, targets };
}

/** Self-service: the caller's own LOCKED payslips with lines, newest first. */
export async function myPayslips(userId: number) {
  const emp = await prisma.employee.findUnique({ where: { userId }, select: { id: true } });
  if (!emp) return [];
  const slips = await prisma.payslip.findMany({ where: { employeeId: emp.id, status: "LOCKED" }, orderBy: [{ year: "desc" }, { month: "desc" }], include: { lines: true } });
  for (const s of slips) s.lines.sort((a, b) => kindOrder(a.kind) - kindOrder(b.kind) || a.id - b.id);
  return slips;
}
