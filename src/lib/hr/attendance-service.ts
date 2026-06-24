import "server-only";
import { prisma } from "@/lib/db";
import { nextUid } from "@/lib/uid";
import { clean } from "@/lib/text";
import { countWorkingDays, expandHolidayKeys, parseWeeklyOff, effectiveAllowance, type LeaveType } from "./attendance-logic";
import { proratedAllowance } from "./hr-logic";

const yearStart = (y: number) => new Date(Date.UTC(y, 0, 1));
const yearEnd = (y: number) => new Date(Date.UTC(y, 11, 31, 23, 59, 59));
const utcDay = (s: string) => new Date(`${s}T00:00:00Z`);

// ── Config + allowances ─────────────────────────────────────────────────────
export async function getHrConfig() {
  // orderBy makes this a deterministic singleton read — if a row ever got
  // duplicated, every caller still resolves the same (earliest) config.
  return (await prisma.hrConfig.findFirst({ orderBy: { id: "asc" } })) ?? (await prisma.hrConfig.create({ data: {} }));
}
export async function setHrConfig(input: { annualDefault: number; urgentDefault: number; weeklyOffDays: string }, userId: number) {
  const cfg = await getHrConfig();
  return prisma.hrConfig.update({ where: { id: cfg.id }, data: { ...input, updatedById: userId } });
}
export async function setEmployeeAllowance(employeeId: number, annual: number | null, urgent: number | null, userId: number) {
  await prisma.employee.update({ where: { id: employeeId }, data: { annualAllowance: annual, urgentAllowance: urgent, updatedById: userId } });
  await prisma.employeeEvent.create({ data: { employeeId, type: "PROFILE_EDIT", message: "Leave allowance updated.", byUserId: userId } });
}

/** Date-key set of all (non-archived) holiday days. */
export async function holidayKeySet(): Promise<Set<string>> {
  const hs = await prisma.holiday.findMany({ where: { archivedAt: null }, select: { startDate: true, endDate: true } });
  return expandHolidayKeys(hs);
}

async function employeeNames(ids: number[]): Promise<Map<number, string>> {
  if (!ids.length) return new Map();
  const emps = await prisma.employee.findMany({ where: { id: { in: ids } }, select: { id: true, user: { select: { name: true } } } });
  return new Map(emps.map((e) => [e.id, e.user?.name ?? `#${e.id}`]));
}

// ── Balances ────────────────────────────────────────────────────────────────
export interface LeaveBalance {
  allowance: number;
  used: number;
  remaining: number;
}
export async function leaveBalance(employeeId: number, year: number): Promise<{ annual: LeaveBalance; urgent: LeaveBalance }> {
  const [emp, cfg] = await Promise.all([
    prisma.employee.findUnique({ where: { id: employeeId }, select: { annualAllowance: true, urgentAllowance: true, hiringDate: true } }),
    getHrConfig(),
  ]);
  const approved = await prisma.leaveRequest.findMany({
    where: { employeeId, status: "APPROVED", startDate: { gte: yearStart(year), lte: yearEnd(year) } },
    select: { type: true, days: true },
  });
  const urgentAbsences = await prisma.absence.count({ where: { employeeId, coveredByUrgent: true, date: { gte: yearStart(year), lte: yearEnd(year) } } });
  let usedAnnual = 0;
  let usedUrgent = 0;
  for (const r of approved) r.type === "ANNUAL" ? (usedAnnual += r.days) : (usedUrgent += r.days);
  usedUrgent += urgentAbsences;
  // Mid-year hires get a pro-rated yearly allowance (full once they've served a whole year).
  const annualAllow = proratedAllowance(effectiveAllowance(emp?.annualAllowance, cfg.annualDefault), emp?.hiringDate ?? null, year);
  const urgentAllow = proratedAllowance(effectiveAllowance(emp?.urgentAllowance, cfg.urgentDefault), emp?.hiringDate ?? null, year);
  return {
    annual: { allowance: annualAllow, used: usedAnnual, remaining: annualAllow - usedAnnual },
    urgent: { allowance: urgentAllow, used: usedUrgent, remaining: urgentAllow - usedUrgent },
  };
}

// ── Leave requests ─────────────────────────────────────────────────────────
export interface LeaveRow {
  id: number;
  uid: string | null;
  employeeId: number;
  employeeName: string;
  type: string;
  startDate: Date;
  endDate: Date;
  days: number;
  reason: string | null;
  status: string;
}
type LeaveRecord = Awaited<ReturnType<typeof prisma.leaveRequest.findMany>>[number];
async function decorate(reqs: LeaveRecord[]): Promise<LeaveRow[]> {
  const names = await employeeNames([...new Set(reqs.map((r) => r.employeeId))]);
  return reqs.map((r) => ({
    id: r.id, uid: r.uid, employeeId: r.employeeId, employeeName: names.get(r.employeeId) ?? `#${r.employeeId}`,
    type: r.type, startDate: r.startDate, endDate: r.endDate, days: r.days, reason: r.reason, status: r.status,
  }));
}

export async function createLeaveRequest(employeeId: number, type: LeaveType, startStr: string, endStr: string, reason: string | null, createdById: number) {
  const start = utcDay(startStr);
  const end = utcDay(endStr);
  const cfg = await getHrConfig();
  const days = countWorkingDays(start, end, parseWeeklyOff(cfg.weeklyOffDays), await holidayKeySet());
  if (days <= 0) throw new Error("The selected range has no working days.");
  const uid = await nextUid("LV");
  return prisma.leaveRequest.create({ data: { uid, employeeId, type, startDate: start, endDate: end, days, reason: clean(reason), createdById } });
}

/**
 * Approve or decline a pending leave request. Approving enforces the employee's
 * remaining balance for that leave type — the check and the status flip run in one
 * transaction so two stacked requests can't both be approved past the allowance.
 * Returns an i18n error key when it can't proceed.
 */
export async function decideLeave(id: number, approve: boolean, note: string | null, deciderId: number): Promise<{ ok: boolean; error?: string }> {
  const lr = await prisma.leaveRequest.findUnique({ where: { id }, select: { status: true, type: true, days: true, employeeId: true, startDate: true } });
  if (!lr || lr.status !== "PENDING") return { ok: false, error: "leave.notPending" };

  if (!approve) {
    await prisma.leaveRequest.update({
      where: { id },
      data: { status: "DECLINED", decidedById: deciderId, decidedAt: new Date(), decidedNote: clean(note) },
    });
    return { ok: true };
  }

  const year = lr.startDate.getUTCFullYear();
  const result = await prisma.$transaction(async (tx) => {
    const [emp, cfg] = await Promise.all([
      tx.employee.findUnique({ where: { id: lr.employeeId }, select: { annualAllowance: true, urgentAllowance: true } }),
      tx.hrConfig.findFirst(),
    ]);
    const approved = await tx.leaveRequest.findMany({
      where: { employeeId: lr.employeeId, status: "APPROVED", type: lr.type, startDate: { gte: yearStart(year), lte: yearEnd(year) } },
      select: { days: true },
    });
    let used = approved.reduce((s, r) => s + r.days, 0);
    if (lr.type === "URGENT") {
      used += await tx.absence.count({ where: { employeeId: lr.employeeId, coveredByUrgent: true, date: { gte: yearStart(year), lte: yearEnd(year) } } });
    }
    const allowance =
      lr.type === "ANNUAL"
        ? effectiveAllowance(emp?.annualAllowance, cfg?.annualDefault ?? 0)
        : effectiveAllowance(emp?.urgentAllowance, cfg?.urgentDefault ?? 0);
    if (lr.days > allowance - used) return { ok: false, error: "leave.insufficient" };
    await tx.leaveRequest.update({
      where: { id },
      data: { status: "APPROVED", decidedById: deciderId, decidedAt: new Date(), decidedNote: clean(note) },
    });
    return { ok: true };
  });
  // Approving an urgent leave consumes shared capacity → re-derive absence coverage.
  if (result.ok && lr.type === "URGENT") await recomputeAbsenceCoverage(lr.employeeId, year);
  return result;
}

export function getLeaveRequest(id: number) {
  return prisma.leaveRequest.findUnique({ where: { id } });
}

export async function listMyRequests(employeeId: number): Promise<LeaveRow[]> {
  return decorate(await prisma.leaveRequest.findMany({ where: { employeeId }, orderBy: { createdAt: "desc" }, take: 50 }));
}

/** Pending leaves the actor may decide: HR/admin see all; a manager sees their direct reports'. */
export async function pendingApprovals(access: { isAdmin: boolean; can: (m: string, c: string) => boolean; user?: { id: number } | null }): Promise<LeaveRow[]> {
  if (access.isAdmin || access.can("human_resources", "manage")) {
    return decorate(await prisma.leaveRequest.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, take: 100 }));
  }
  const uid = access.user?.id;
  if (uid == null) return [];
  const actor = await prisma.employee.findUnique({ where: { userId: uid }, select: { id: true } });
  if (!actor) return [];
  const reports = await prisma.employee.findMany({ where: { lineManagerId: actor.id }, select: { id: true } });
  const ids = reports.map((r) => r.id);
  if (!ids.length) return [];
  return decorate(await prisma.leaveRequest.findMany({ where: { status: "PENDING", employeeId: { in: ids } }, orderBy: { createdAt: "asc" }, take: 100 }));
}

// ── Absences ──────────────────────────────────────────────────────────────

/**
 * Re-derive each absence's `coveredByUrgent` flag deterministically: the urgent
 * allowance not already taken by approved urgent leave covers the *chronologically
 * first* absences; the rest are over-limit (→ payroll penalty). Recomputed on every
 * change so the flags never depend on the order absences were marked, and a freed
 * slot (deleted absence / declined leave) promotes a later over-limit one.
 */
export async function recomputeAbsenceCoverage(employeeId: number, year: number): Promise<void> {
  const [emp, cfg] = await Promise.all([
    prisma.employee.findUnique({ where: { id: employeeId }, select: { urgentAllowance: true } }),
    getHrConfig(),
  ]);
  const allowance = effectiveAllowance(emp?.urgentAllowance, cfg.urgentDefault);
  const approvedUrgentLeave = await prisma.leaveRequest.findMany({
    where: { employeeId, status: "APPROVED", type: "URGENT", startDate: { gte: yearStart(year), lte: yearEnd(year) } },
    select: { days: true },
  });
  const usedByLeave = approvedUrgentLeave.reduce((s, r) => s + r.days, 0);
  const capacity = Math.max(0, allowance - usedByLeave);
  const absences = await prisma.absence.findMany({
    where: { employeeId, date: { gte: yearStart(year), lte: yearEnd(year) } },
    orderBy: { date: "asc" },
    select: { id: true, coveredByUrgent: true },
  });
  const ops = absences
    .map((a, i) => ({ id: a.id, want: i < capacity, has: a.coveredByUrgent }))
    .filter((a) => a.want !== a.has)
    .map((a) => prisma.absence.update({ where: { id: a.id }, data: { coveredByUrgent: a.want } }));
  if (ops.length) await prisma.$transaction(ops);
}

export async function markAbsence(employeeId: number, dateStr: string, note: string | null, markedById: number) {
  const date = utcDay(dateStr);
  await prisma.absence.upsert({
    where: { employeeId_date: { employeeId, date } },
    update: { note: clean(note), markedById },
    create: { employeeId, date, note: clean(note), coveredByUrgent: false, markedById },
  });
  await recomputeAbsenceCoverage(employeeId, date.getUTCFullYear());
}
export async function clearAbsence(employeeId: number, dateStr: string) {
  const date = utcDay(dateStr);
  await prisma.absence.deleteMany({ where: { employeeId, date } });
  await recomputeAbsenceCoverage(employeeId, date.getUTCFullYear());
}
export function listAbsences(employeeId: number, year: number) {
  return prisma.absence.findMany({ where: { employeeId, date: { gte: yearStart(year), lte: yearEnd(year) } }, orderBy: { date: "desc" } });
}

// ── Holidays ────────────────────────────────────────────────────────────────
export function listHolidays() {
  return prisma.holiday.findMany({ where: { archivedAt: null }, orderBy: { startDate: "asc" }, include: { bonuses: true } });
}
export function getHoliday(id: number) {
  return prisma.holiday.findFirst({ where: { id, archivedAt: null }, include: { bonuses: true } });
}
export interface HolidayInput {
  title: string;
  titleAr?: string | null;
  type: string;
  startDate: string;
  endDate: string;
  notes?: string | null;
}
export async function createHoliday(input: HolidayInput, userId: number) {
  const uid = await nextUid("HOL");
  return prisma.holiday.create({
    data: { uid, title: input.title.trim(), titleAr: clean(input.titleAr), type: input.type, startDate: utcDay(input.startDate), endDate: utcDay(input.endDate), notes: clean(input.notes), createdById: userId },
  });
}
export async function updateHoliday(id: number, input: HolidayInput, userId: number) {
  return prisma.holiday.update({
    where: { id },
    data: { title: input.title.trim(), titleAr: clean(input.titleAr), type: input.type, startDate: utcDay(input.startDate), endDate: utcDay(input.endDate), notes: clean(input.notes) },
  });
}
export async function archiveHoliday(id: number) {
  return prisma.holiday.update({ where: { id }, data: { archivedAt: new Date() } });
}
/** Set (or clear, when amount ≤ 0) a per-team working-day bonus for a holiday. */
export async function setHolidayBonus(holidayId: number, teamId: number, amountPerDay: number) {
  if (!(amountPerDay > 0)) {
    await prisma.holidayBonus.deleteMany({ where: { holidayId, teamId } });
    return;
  }
  await prisma.holidayBonus.upsert({ where: { holidayId_teamId: { holidayId, teamId } }, update: { amountPerDay }, create: { holidayId, teamId, amountPerDay } });
}
export function teamsForBonus() {
  return prisma.team.findMany({ orderBy: { key: "asc" }, select: { id: true, key: true } });
}

// ── Salary components catalog (Phase 2.5) ────────────────────────────────────
export function listSalaryComponents() {
  return prisma.salaryComponent.findMany({ where: { archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
}
export interface ComponentInput {
  code: string;
  name: string;
  nameAr?: string | null;
  kind: string;
  valuation: string;
  defaultAmount?: number | null;
  notes?: string | null;
}
export async function createSalaryComponent(input: ComponentInput, userId: number) {
  return prisma.salaryComponent.create({ data: { code: input.code.trim(), name: input.name.trim(), nameAr: clean(input.nameAr), kind: input.kind, valuation: input.valuation, defaultAmount: input.defaultAmount ?? null, notes: clean(input.notes), createdById: userId } });
}
export async function updateSalaryComponent(id: number, input: Omit<ComponentInput, "code">) {
  return prisma.salaryComponent.update({ where: { id }, data: { name: input.name.trim(), nameAr: clean(input.nameAr), kind: input.kind, valuation: input.valuation, defaultAmount: input.defaultAmount ?? null, notes: clean(input.notes) } });
}
export async function archiveSalaryComponent(id: number) {
  return prisma.salaryComponent.update({ where: { id }, data: { archivedAt: new Date() } });
}

// ── Day types catalog ────────────────────────────────────────────────────────
export function listDayTypes() {
  return prisma.dayType.findMany({ where: { archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
}
export function dutyDayTypes() {
  return prisma.dayType.findMany({ where: { archivedAt: null, dayClass: "DUTY" }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
}
export interface DayTypeInput {
  code: string;
  name: string;
  nameAr?: string | null;
  dayClass: string;
  bonusComponentId?: number | null;
  penaltyComponentId?: number | null;
}
export async function createDayType(input: DayTypeInput, userId: number) {
  return prisma.dayType.create({
    data: { code: input.code.trim(), name: input.name.trim(), nameAr: clean(input.nameAr), dayClass: input.dayClass, bonusComponentId: input.bonusComponentId ?? null, penaltyComponentId: input.penaltyComponentId ?? null, createdById: userId },
  });
}
export async function updateDayType(id: number, input: Omit<DayTypeInput, "code">) {
  return prisma.dayType.update({
    where: { id },
    data: { name: input.name.trim(), nameAr: clean(input.nameAr), dayClass: input.dayClass, bonusComponentId: input.bonusComponentId ?? null, penaltyComponentId: input.penaltyComponentId ?? null },
  });
}
export async function archiveDayType(id: number) {
  return prisma.dayType.update({ where: { id }, data: { archivedAt: new Date() } });
}

// ── Duty days (manual: worked a non-working day / training) ──────────────────
export async function markDuty(employeeId: number, dateStr: string, dayTypeId: number, note: string | null, markedById: number) {
  const date = utcDay(dateStr);
  await prisma.dutyDay.upsert({
    where: { employeeId_date: { employeeId, date } },
    update: { dayTypeId, note: clean(note), markedById },
    create: { employeeId, date, dayTypeId, note: clean(note), markedById },
  });
}
export async function clearDuty(employeeId: number, dateStr: string) {
  await prisma.dutyDay.deleteMany({ where: { employeeId, date: utcDay(dateStr) } });
}
export async function listDuties(employeeId: number, year: number) {
  const duties = await prisma.dutyDay.findMany({ where: { employeeId, date: { gte: yearStart(year), lte: yearEnd(year) } }, orderBy: { date: "desc" } });
  const typeIds = [...new Set(duties.map((d) => d.dayTypeId))];
  const types = typeIds.length ? await prisma.dayType.findMany({ where: { id: { in: typeIds } }, select: { id: true, code: true, name: true } }) : [];
  const tmap = new Map(types.map((t) => [t.id, t]));
  return duties.map((d) => ({ id: d.id, date: d.date, note: d.note, dayTypeId: d.dayTypeId, dayTypeCode: tmap.get(d.dayTypeId)?.code ?? "?", dayTypeName: tmap.get(d.dayTypeId)?.name ?? "?" }));
}

// ── Vacation→duty mapping (on HrConfig) ──────────────────────────────────────
export async function setDutyMapping(input: { dutyEidDays: string; dutyEidVacation: string; dutyVacation: string; dutyWeekend: string }, userId: number) {
  const cfg = await getHrConfig();
  return prisma.hrConfig.update({ where: { id: cfg.id }, data: { ...input, updatedById: userId } });
}
