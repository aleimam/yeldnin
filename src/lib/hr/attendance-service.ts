import "server-only";
import { prisma } from "@/lib/db";
import { nextUid } from "@/lib/uid";
import { clean } from "@/lib/text";
import { countWorkingDays, expandHolidayKeys, parseWeeklyOff, effectiveAllowance, type LeaveType } from "./attendance-logic";

const yearStart = (y: number) => new Date(Date.UTC(y, 0, 1));
const yearEnd = (y: number) => new Date(Date.UTC(y, 11, 31, 23, 59, 59));
const utcDay = (s: string) => new Date(`${s}T00:00:00Z`);

// ── Config + allowances ─────────────────────────────────────────────────────
export async function getHrConfig() {
  return (await prisma.hrConfig.findFirst()) ?? (await prisma.hrConfig.create({ data: {} }));
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
    prisma.employee.findUnique({ where: { id: employeeId }, select: { annualAllowance: true, urgentAllowance: true } }),
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
  const annualAllow = effectiveAllowance(emp?.annualAllowance, cfg.annualDefault);
  const urgentAllow = effectiveAllowance(emp?.urgentAllowance, cfg.urgentDefault);
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

export async function decideLeave(id: number, approve: boolean, note: string | null, deciderId: number) {
  const lr = await prisma.leaveRequest.findUnique({ where: { id }, select: { status: true } });
  if (!lr || lr.status !== "PENDING") return;
  await prisma.leaveRequest.update({
    where: { id },
    data: { status: approve ? "APPROVED" : "DECLINED", decidedById: deciderId, decidedAt: new Date(), decidedNote: clean(note) },
  });
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
export async function markAbsence(employeeId: number, dateStr: string, note: string | null, markedById: number) {
  const date = utcDay(dateStr);
  const bal = await leaveBalance(employeeId, date.getUTCFullYear());
  const coveredByUrgent = bal.urgent.remaining > 0;
  await prisma.absence.upsert({
    where: { employeeId_date: { employeeId, date } },
    update: { note: clean(note), coveredByUrgent, markedById },
    create: { employeeId, date, note: clean(note), coveredByUrgent, markedById },
  });
}
export async function clearAbsence(employeeId: number, dateStr: string) {
  await prisma.absence.deleteMany({ where: { employeeId, date: utcDay(dateStr) } });
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
