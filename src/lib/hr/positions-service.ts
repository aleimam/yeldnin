import "server-only";
import { prisma } from "@/lib/db";
import { clean } from "@/lib/text";

// ── Departments + Positions (admin-managed org structure) ────────────────────

export function listDepartments(includeArchived = false) {
  return prisma.department.findMany({
    where: includeArchived ? {} : { archivedAt: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export function listPositions(includeArchived = false) {
  return prisma.position.findMany({
    where: includeArchived ? {} : { archivedAt: null },
    include: { department: { select: { id: true, name: true, nameAr: true } } },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  });
}

export interface DeptRow {
  id: number;
  remove: boolean;
  name: string;
  nameAr: string | null;
}
export async function saveDepartmentBatch(rows: DeptRow[], add: { name: string; nameAr: string | null } | null) {
  const ops = [];
  for (const r of rows) {
    if (r.remove) ops.push(prisma.department.update({ where: { id: r.id }, data: { archivedAt: new Date() } }));
    else if (r.name.trim()) ops.push(prisma.department.update({ where: { id: r.id }, data: { name: r.name.trim(), nameAr: clean(r.nameAr) } }));
  }
  if (add?.name.trim()) ops.push(prisma.department.create({ data: { name: add.name.trim(), nameAr: clean(add.nameAr) } }));
  if (ops.length) await prisma.$transaction(ops);
}

export interface PosRow {
  id: number;
  remove: boolean;
  departmentId: number | null;
  title: string;
  titleAr: string | null;
  grade: string | null;
  description: string | null;
  descriptionAr: string | null;
}
type NewPos = Omit<PosRow, "id" | "remove">;
const posData = (r: NewPos) => ({
  departmentId: r.departmentId,
  title: r.title.trim(),
  titleAr: clean(r.titleAr),
  grade: clean(r.grade),
  description: clean(r.description),
  descriptionAr: clean(r.descriptionAr),
});
export async function savePositionBatch(rows: PosRow[], add: NewPos | null) {
  const ops = [];
  for (const r of rows) {
    if (r.remove) ops.push(prisma.position.update({ where: { id: r.id }, data: { archivedAt: new Date() } }));
    else if (r.title.trim()) ops.push(prisma.position.update({ where: { id: r.id }, data: posData(r) }));
  }
  if (add?.title.trim()) ops.push(prisma.position.create({ data: posData(add) }));
  if (ops.length) await prisma.$transaction(ops);
}
