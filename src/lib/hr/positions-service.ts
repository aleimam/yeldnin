import "server-only";
import { prisma } from "@/lib/db";
import { clean } from "@/lib/text";

// ── Positions (admin-managed job titles) ─────────────────────────────────────
// Departments are the same thing as Teams now (an employee's department is their
// team membership), so a Position is just a flat job title.

export function listPositions(includeArchived = false) {
  return prisma.position.findMany({
    where: includeArchived ? {} : { archivedAt: null },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  });
}

export interface PosRow {
  id: number;
  remove: boolean;
  title: string;
  titleAr: string | null;
  grade: string | null;
  description: string | null;
  descriptionAr: string | null;
}
type NewPos = Omit<PosRow, "id" | "remove">;
const posData = (r: NewPos) => ({
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
