import "server-only";
import { prisma } from "@/lib/db";

/** Append a row to the cross-module audit trail. Best-effort (never throws). */
export async function writeAudit(
  userId: number | null,
  action: string,
  entityType: string,
  entityId: string | number,
  meta?: unknown,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
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

export function listAudit(entityType?: string, take = 200) {
  return prisma.auditLog.findMany({
    where: entityType ? { entityType } : {},
    orderBy: { createdAt: "desc" },
    take,
  });
}
