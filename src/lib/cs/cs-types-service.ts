import "server-only";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

/** Editable evaluation-type list for a scope (CALL or PERIODICAL). */
export function listCsTypes(scope: string, includeArchived = false) {
  return prisma.csEvalType.findMany({
    where: { scope, ...(includeArchived ? {} : { archivedAt: null }) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export interface CsTypeRow {
  id: number;
  remove: boolean;
  name: string;
}

/** Save-all batch for one scope: rename/soft-delete existing + optionally add one. */
export async function saveCsTypeBatch(scope: string, rows: CsTypeRow[], add: { name: string } | null, userId: number) {
  const ops = [];
  for (const r of rows) {
    if (r.remove) ops.push(prisma.csEvalType.update({ where: { id: r.id }, data: { archivedAt: new Date() } }));
    else if (r.name.trim()) ops.push(prisma.csEvalType.update({ where: { id: r.id }, data: { name: r.name.trim() } }));
  }
  if (add?.name.trim()) {
    const max = await prisma.csEvalType.aggregate({ _max: { sortOrder: true }, where: { scope } });
    ops.push(prisma.csEvalType.create({ data: { scope, name: add.name.trim(), sortOrder: (max._max.sortOrder ?? 0) + 1 } }));
  }
  if (ops.length) await prisma.$transaction(ops);
  await writeAudit(userId, "cs_quality", "type.save", "csType", 0, { scope });
}
