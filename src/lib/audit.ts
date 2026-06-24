import "server-only";
import { prisma } from "@/lib/db";

/** Append a row to the cross-module audit trail. Best-effort (never throws). */
export async function writeAudit(
  userId: number | null,
  moduleKey: string,
  action: string,
  entityType: string,
  entityId: string | number,
  meta?: unknown,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        moduleKey,
        action,
        entityType,
        entityId: String(entityId),
        meta: meta === undefined ? null : JSON.stringify(meta),
      },
    });
  } catch {
    // auditing must never break the primary operation
  }
}

export function listAudit(opts: { moduleKey?: string; take?: number } = {}) {
  return prisma.auditLog.findMany({
    where: opts.moduleKey ? { moduleKey: opts.moduleKey } : {},
    orderBy: { createdAt: "desc" },
    take: opts.take ?? 200,
  });
}

/** Paginated + filtered audit trail (for the Audit page). */
export async function listAuditPaged(opts: { moduleKey?: string; search?: string; skip?: number; take?: number } = {}) {
  const where = {
    ...(opts.moduleKey ? { moduleKey: opts.moduleKey } : {}),
    ...(opts.search
      ? {
          OR: [
            { action: { contains: opts.search } },
            { entityType: { contains: opts.search } },
            { entityId: { contains: opts.search } },
          ],
        }
      : {}),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: opts.skip ?? 0, take: opts.take ?? 50 }),
    prisma.auditLog.count({ where }),
  ]);
  return { rows, total };
}

/** Distinct module keys that have at least one audit entry. */
export async function auditModuleKeys(): Promise<string[]> {
  const rows = await prisma.auditLog.findMany({
    distinct: ["moduleKey"],
    select: { moduleKey: true },
  });
  return rows.map((r) => r.moduleKey).filter(Boolean);
}
