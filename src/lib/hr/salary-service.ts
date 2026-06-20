import "server-only";
import { prisma } from "@/lib/db";
import { clean } from "@/lib/text";
import { applyChange, monthlyBaseEarnings, type ChangeType } from "./salary-logic";

const utcDay = (s: string) => new Date(`${s}T00:00:00Z`);
const KIND_ORDER: Record<string, number> = { EARNING: 0, BONUS: 1, PENALTY: 2 };

// ── Read: an employee's salary structure ─────────────────────────────────────
export interface StructureLineView {
  id: number;
  componentId: number;
  code: string;
  name: string;
  nameAr: string | null;
  kind: string;
  valuation: string;
  amount: number;
  active: boolean;
}

export async function listStructure(employeeId: number): Promise<{ lines: StructureLineView[]; monthlyBase: number }> {
  const lines = await prisma.salaryStructureLine.findMany({ where: { employeeId }, include: { component: true } });
  lines.sort(
    (a, b) =>
      (KIND_ORDER[a.component.kind] ?? 9) - (KIND_ORDER[b.component.kind] ?? 9) ||
      a.component.sortOrder - b.component.sortOrder ||
      a.id - b.id,
  );
  const view = lines.map((l) => ({
    id: l.id,
    componentId: l.componentId,
    code: l.component.code,
    name: l.component.name,
    nameAr: l.component.nameAr,
    kind: l.component.kind,
    valuation: l.component.valuation,
    amount: l.amount,
    active: l.active,
  }));
  const monthlyBase = monthlyBaseEarnings(lines.map((l) => ({ amount: l.amount, active: l.active, component: { kind: l.component.kind, valuation: l.component.valuation } })));
  return { lines: view, monthlyBase };
}

/** Components not archived and not already on this employee's structure. */
export async function eligibleComponents(employeeId: number) {
  const have = (await prisma.salaryStructureLine.findMany({ where: { employeeId }, select: { componentId: true } })).map((l) => l.componentId);
  return prisma.salaryComponent.findMany({ where: { archivedAt: null, id: { notIn: have } }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
}

// ── Write: apply a change to one line (add / set / raise) ─────────────────────
function describeChange(name: string, type: ChangeType, delta: number, oldAmount: number, newAmount: number, isNew: boolean): string {
  const f = (n: number) => n.toFixed(2);
  if (type === "SET") return isNew ? `${name} added to salary structure at ${f(newAmount)}.` : `${name} set to ${f(newAmount)} (was ${f(oldAmount)}).`;
  if (type === "PERCENT") return `${name} ${delta >= 0 ? "increased" : "decreased"} ${Math.abs(delta)}% (${f(oldAmount)} → ${f(newAmount)}).`;
  return `${name} changed by ${delta >= 0 ? "+" : ""}${f(delta)} (${f(oldAmount)} → ${f(newAmount)}).`;
}

export interface LineChange {
  employeeId: number;
  componentId: number;
  type: ChangeType;
  delta: number;
  effectiveDate: string;
  reason?: string | null;
  byUserId: number;
  batchId?: string;
}

export async function applyLineChange(p: LineChange) {
  const existing = await prisma.salaryStructureLine.findUnique({ where: { employeeId_componentId: { employeeId: p.employeeId, componentId: p.componentId } } });
  const oldAmount = existing?.amount ?? 0;
  const newAmount = applyChange(oldAmount, p.type, p.delta);
  const line = existing
    ? await prisma.salaryStructureLine.update({ where: { id: existing.id }, data: { amount: newAmount, active: true, updatedById: p.byUserId } })
    : await prisma.salaryStructureLine.create({ data: { employeeId: p.employeeId, componentId: p.componentId, amount: newAmount, createdById: p.byUserId, updatedById: p.byUserId } });
  await prisma.salaryChange.create({
    data: { lineId: line.id, changeType: p.type, delta: p.delta, oldAmount, newAmount, effectiveDate: utcDay(p.effectiveDate), reason: clean(p.reason), batchId: p.batchId ?? null, byUserId: p.byUserId },
  });
  const comp = await prisma.salaryComponent.findUnique({ where: { id: p.componentId }, select: { name: true } });
  await prisma.employeeEvent.create({ data: { employeeId: p.employeeId, type: "PROFILE_EDIT", message: describeChange(comp?.name ?? "Component", p.type, p.delta, oldAmount, newAmount, !existing), byUserId: p.byUserId } });
  return line;
}

/** Enable/disable a line without losing its history. */
export async function setLineActive(lineId: number, active: boolean, byUserId: number) {
  const line = await prisma.salaryStructureLine.update({ where: { id: lineId }, data: { active, updatedById: byUserId }, include: { component: { select: { name: true } } } });
  await prisma.employeeEvent.create({ data: { employeeId: line.employeeId, type: "PROFILE_EDIT", message: `${line.component.name} ${active ? "enabled" : "disabled"} in salary structure.`, byUserId } });
  return line;
}

// ── Bulk raise: one component across a team (or everyone with that component) ──
export interface BulkRaise {
  componentId: number;
  teamId: number | null; // null = ALL employees who have this component
  type: ChangeType;
  delta: number;
  effectiveDate: string;
  reason?: string | null;
  byUserId: number;
}

export async function bulkRaise(p: BulkRaise): Promise<{ count: number; batchId: string }> {
  let employeeIds: number[];
  if (p.teamId == null) {
    employeeIds = (await prisma.salaryStructureLine.findMany({ where: { componentId: p.componentId }, select: { employeeId: true } })).map((l) => l.employeeId);
  } else {
    const userIds = (await prisma.teamMember.findMany({ where: { teamId: p.teamId }, select: { userId: true } })).map((m) => m.userId);
    employeeIds = (await prisma.employee.findMany({ where: { userId: { in: userIds } }, select: { id: true } })).map((e) => e.id);
  }
  const batchId = `bulk_${Date.now()}`;
  let count = 0;
  for (const employeeId of employeeIds) {
    // Only adjust existing structures — bulk raise never creates new lines.
    const existing = await prisma.salaryStructureLine.findUnique({ where: { employeeId_componentId: { employeeId, componentId: p.componentId } } });
    if (!existing) continue;
    await applyLineChange({ employeeId, componentId: p.componentId, type: p.type, delta: p.delta, effectiveDate: p.effectiveDate, reason: p.reason, byUserId: p.byUserId, batchId });
    count++;
  }
  return { count, batchId };
}

// ── Read: raise history for an employee ──────────────────────────────────────
export async function listChanges(employeeId: number) {
  const lines = await prisma.salaryStructureLine.findMany({ where: { employeeId }, select: { id: true, componentId: true } });
  if (!lines.length) return [];
  const changes = await prisma.salaryChange.findMany({ where: { lineId: { in: lines.map((l) => l.id) } }, orderBy: [{ effectiveDate: "desc" }, { id: "desc" }], take: 100 });
  const comps = await prisma.salaryComponent.findMany({ where: { id: { in: [...new Set(lines.map((l) => l.componentId))] } }, select: { id: true, name: true, nameAr: true } });
  const lineComp = new Map(lines.map((l) => [l.id, l.componentId]));
  const compMap = new Map(comps.map((c) => [c.id, c]));
  return changes.map((ch) => {
    const comp = compMap.get(lineComp.get(ch.lineId) ?? -1);
    return { id: ch.id, effectiveDate: ch.effectiveDate, changeType: ch.changeType, delta: ch.delta, oldAmount: ch.oldAmount, newAmount: ch.newAmount, reason: ch.reason, componentName: comp?.name ?? "?", componentNameAr: comp?.nameAr ?? null };
  });
}

// ── Self-service: resolve the caller's own employee + structure (read-only) ──
export async function myStructure(userId: number) {
  const emp = await prisma.employee.findUnique({ where: { userId }, select: { id: true } });
  if (!emp) return null;
  const [structure, changes] = await Promise.all([listStructure(emp.id), listChanges(emp.id)]);
  return { employeeId: emp.id, ...structure, changes };
}
