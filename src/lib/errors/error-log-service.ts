import "server-only";
import { prisma } from "@/lib/db";

export const ERROR_LEVELS = ["error", "warn", "info"] as const;
const RETENTION_DAYS = 30;
const MAX_FIELD = 8000; // cap stored text so a runaway message can't bloat the DB

export interface LogErrorInput {
  level?: string; // error | warn | info (default error)
  source?: string | null; // action | route | client | cron | <module>
  message: string;
  stack?: string | null;
  url?: string | null;
  method?: string | null;
  userId?: number | null;
  meta?: unknown; // JSON-serialised
}

function trim(v: string | null | undefined): string | null {
  if (v == null) return null;
  return v.length > MAX_FIELD ? v.slice(0, MAX_FIELD) : v;
}

/** Append one row to the error log. Best-effort — never throws (logging must not
 *  itself break the request). Returns the row id, or null on failure. */
export async function logError(input: LogErrorInput): Promise<number | null> {
  try {
    const level = (ERROR_LEVELS as readonly string[]).includes(input.level ?? "") ? input.level! : "error";
    const row = await prisma.errorLog.create({
      data: {
        level,
        source: trim(input.source) ?? null,
        message: trim(input.message) ?? "(no message)",
        stack: trim(input.stack ?? null),
        url: trim(input.url ?? null),
        method: trim(input.method ?? null),
        userId: input.userId ?? null,
        meta: input.meta === undefined ? null : trim(JSON.stringify(input.meta)),
      },
      select: { id: true },
    });
    return row.id;
  } catch {
    return null;
  }
}

/** Paginated + filtered error log (newest first). */
export async function listErrorLogsPaged(opts: { level?: string; source?: string; search?: string; skip?: number; take?: number }) {
  const where = {
    ...(opts.level ? { level: opts.level } : {}),
    ...(opts.source ? { source: opts.source } : {}),
    ...(opts.search
      ? {
          OR: [
            { message: { contains: opts.search } },
            { url: { contains: opts.search } },
            { method: { contains: opts.search } },
          ],
        }
      : {}),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.errorLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: opts.skip ?? 0, take: opts.take ?? 50 }),
    prisma.errorLog.count({ where }),
  ]);
  return { rows, total };
}

/** Distinct sources present in the log (for the filter dropdown). */
export async function errorLogSources(): Promise<string[]> {
  const rows = await prisma.errorLog.findMany({ distinct: ["source"], select: { source: true }, orderBy: { source: "asc" } });
  return rows.map((r) => r.source).filter((s): s is string => !!s);
}

/** Drop rows older than the retention window (30 days). Returns the deleted count. */
export async function pruneOldErrorLogs(days = RETENTION_DAYS): Promise<number> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const res = await prisma.errorLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return res.count;
}

/** Admin: clear the entire log. Returns the deleted count. */
export async function clearAllErrorLogs(): Promise<number> {
  const res = await prisma.errorLog.deleteMany({});
  return res.count;
}
