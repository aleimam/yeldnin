import "server-only";
import { prisma } from "@/lib/db";
import { round2, monthlyBaseEarnings } from "./salary-logic";
import { generateDraft } from "./payroll-service";
import { average, median, sumByKey, recentMonths, monthLabel } from "./analytics-logic";

const sum = (ns: number[]) => round2(ns.reduce((s, n) => s + n, 0));

/** Active employees (not archived, user not deactivated) with display name. */
async function activeEmployees() {
  const emps = await prisma.employee.findMany({ where: { archivedAt: null }, select: { id: true, userId: true, user: { select: { name: true, active: true } } } });
  return emps.filter((e) => e.user?.active !== false);
}

/** Each employee's projected recurring monthly earnings (active FIXED_MONTHLY). */
async function projectionByEmployee(): Promise<Map<number, number>> {
  const lines = await prisma.salaryStructureLine.findMany({ where: { active: true }, include: { component: { select: { kind: true, valuation: true } } } });
  const byEmp = new Map<number, { amount: number; active: boolean; component: { kind: string; valuation: string } }[]>();
  for (const l of lines) {
    const arr = byEmp.get(l.employeeId) ?? [];
    arr.push({ amount: l.amount, active: l.active, component: { kind: l.component.kind, valuation: l.component.valuation } });
    byEmp.set(l.employeeId, arr);
  }
  const out = new Map<number, number>();
  for (const [empId, ls] of byEmp) out.set(empId, monthlyBaseEarnings(ls));
  return out;
}

// ── Payroll dashboard: one month across all employees ────────────────────────
export async function payrollMonth(year: number, month: number) {
  const [emps, proj, slips] = await Promise.all([
    activeEmployees(),
    projectionByEmployee(),
    prisma.payslip.findMany({ where: { year, month }, select: { id: true, employeeId: true, status: true, net: true } }),
  ]);
  const slipByEmp = new Map(slips.map((s) => [s.employeeId, s]));
  const rows = emps
    .map((e) => {
      const s = slipByEmp.get(e.id);
      return { employeeId: e.id, name: e.user?.name ?? `#${e.id}`, projected: proj.get(e.id) ?? 0, status: s?.status ?? "NONE", payslipId: s?.id ?? null, net: s?.net ?? null };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  const totals = {
    headcount: rows.length,
    projected: sum(rows.map((r) => r.projected)),
    runNet: sum(slips.map((s) => s.net)),
    locked: rows.filter((r) => r.status === "LOCKED").length,
    draft: rows.filter((r) => r.status === "DRAFT").length,
    none: rows.filter((r) => r.status === "NONE").length,
  };
  return { rows, totals };
}

/** Generate a Draft payslip for every active employee without a LOCKED one. */
export async function generateAllDrafts(year: number, month: number, userId: number) {
  const emps = await activeEmployees();
  const locked = new Set((await prisma.payslip.findMany({ where: { year, month, status: "LOCKED" }, select: { employeeId: true } })).map((s) => s.employeeId));
  let count = 0;
  for (const e of emps) {
    if (locked.has(e.id)) continue;
    await generateDraft(e.id, year, month, userId);
    count++;
  }
  return { count };
}

// ── Salary analytics ─────────────────────────────────────────────────────────
export async function salaryAnalytics(now: { year: number; month: number }) {
  const [emps, proj, memberships, lockedSlips] = await Promise.all([
    activeEmployees(),
    projectionByEmployee(),
    prisma.teamMember.findMany({ select: { userId: true, team: { select: { name: true } } } }),
    prisma.payslip.findMany({ where: { status: "LOCKED" }, select: { year: true, month: true, net: true } }),
  ]);
  const values = emps.map((e) => proj.get(e.id) ?? 0);
  const earners = values.filter((v) => v > 0);
  const empByUser = new Map(emps.map((e) => [e.userId, e.id]));
  const byTeam = sumByKey(memberships.filter((m) => empByUser.has(m.userId)), (m) => m.team.name, (m) => proj.get(empByUser.get(m.userId)!) ?? 0);

  const months = recentMonths(now.year, now.month, 6);
  const trend = months.map(({ year, month }) => {
    const ms = lockedSlips.filter((s) => s.year === year && s.month === month);
    return { label: monthLabel(year, month), net: sum(ms.map((s) => s.net)), count: ms.length };
  });

  return {
    headcount: emps.length,
    projectedTotal: sum(values),
    average: average(values),
    median: median(earners),
    withSalary: earners.length,
    byTeam: Object.entries(byTeam).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total),
    trend,
  };
}

// ── Bonuses & Penalties tracker (from locked payslips) ───────────────────────
export async function bonusPenaltyAgg() {
  const lines = await prisma.payslipLine.findMany({
    where: { kind: { in: ["BONUS", "PENALTY"] }, payslip: { status: "LOCKED" } },
    select: { kind: true, label: true, amount: true, payslip: { select: { year: true, month: true, employee: { select: { user: { select: { name: true } } } } } } },
  });
  const bonus = lines.filter((l) => l.kind === "BONUS");
  const penalty = lines.filter((l) => l.kind === "PENALTY");
  const toBreakdown = (ls: typeof lines) => Object.entries(sumByKey(ls, (l) => l.label, (l) => l.amount)).map(([label, total]) => ({ label, total })).sort((a, b) => b.total - a.total);
  const recent = [...lines]
    .sort((a, b) => b.payslip.year - a.payslip.year || b.payslip.month - a.payslip.month)
    .slice(0, 25)
    .map((l) => ({ kind: l.kind, label: l.label, amount: l.amount, month: monthLabel(l.payslip.year, l.payslip.month), name: l.payslip.employee.user?.name ?? "—" }));
  return {
    bonusTotal: sum(bonus.map((l) => l.amount)),
    penaltyTotal: sum(penalty.map((l) => l.amount)),
    bonusByLabel: toBreakdown(bonus),
    penaltyByLabel: toBreakdown(penalty),
    recent,
  };
}

// ── Company-wide HR activity feed (aggregate life-events) ────────────────────
export async function companyActivity(limit = 40) {
  const events = await prisma.employeeEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, type: true, message: true, createdAt: true, employee: { select: { id: true, user: { select: { name: true } } } } },
  });
  return events.map((e) => ({ id: e.id, type: e.type, message: e.message, createdAt: e.createdAt, employeeId: e.employee.id, name: e.employee.user?.name ?? `#${e.employee.id}` }));
}
