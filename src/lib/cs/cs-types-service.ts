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
  nameAr?: string | null; // Arabic name (Arabic UI; falls back to `name`)
  weight: number; // % within the Calls block (CALL scope only)
}

const wt = (w: unknown) => Math.max(0, Math.round(typeof w === "number" && Number.isFinite(w) ? w : 0));
const clean = (s?: string | null) => s?.trim() || null;

/** Save-all batch for one scope: rename/re-weight/soft-delete existing + optionally add one. */
export async function saveCsTypeBatch(scope: string, rows: CsTypeRow[], add: { name: string; nameAr?: string | null; weight?: number } | null, userId: number) {
  const ops = [];
  for (const r of rows) {
    if (r.remove) ops.push(prisma.csEvalType.update({ where: { id: r.id }, data: { archivedAt: new Date() } }));
    else if (r.name.trim()) ops.push(prisma.csEvalType.update({ where: { id: r.id }, data: { name: r.name.trim(), nameAr: clean(r.nameAr), weight: wt(r.weight) } }));
  }
  if (add?.name.trim()) {
    const max = await prisma.csEvalType.aggregate({ _max: { sortOrder: true }, where: { scope } });
    ops.push(prisma.csEvalType.create({ data: { scope, name: add.name.trim(), nameAr: clean(add.nameAr), weight: wt(add.weight), sortOrder: (max._max.sortOrder ?? 0) + 1 } }));
  }
  if (ops.length) await prisma.$transaction(ops);
  await writeAudit(userId, "cs_quality", "type.save", "csType", 0, { scope });
}
