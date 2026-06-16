import "server-only";
import { prisma } from "@/lib/db";

/**
 * Human-readable code: <PREFIX><YY><MM><seq3>, e.g. PRD2606001.
 * Sequence resets per prefix per month, via the Counter table.
 */
export async function nextUid(prefix: string): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const period = `${yy}${mm}`;
  const row = await prisma.counter.upsert({
    where: { prefix_period: { prefix, period } },
    create: { prefix, period, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${prefix}${period}${String(row.value).padStart(3, "0")}`;
}
