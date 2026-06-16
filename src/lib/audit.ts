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

/** Distinct module keys that have at least one audit entry. */
export async function auditModuleKeys(): Promise<string[]> {
  const rows = await prisma.auditLog.findMany({
    distinct: ["moduleKey"],
    select: { moduleKey: true },
  });
  return rows.map((r) => r.moduleKey).filter(Boolean);
}
