import "server-only";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaNodeSQLite } from "prisma-adapter-node-sqlite";

// Native-free SQLite via node:sqlite (works on win32/arm64). The DB file lives
// at <project>/prisma/dev.db; resolve it absolutely so the runtime cwd doesn't
// matter.
const dbFile = path.join(process.cwd(), "prisma", "dev.db");

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient() {
  const adapter = new PrismaNodeSQLite({ url: `file:${dbFile}` });
  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
  // Tune SQLite for concurrent web traffic. The default DELETE journal makes every
  // write take a database-wide exclusive lock that blocks ALL readers — under
  // multi-user load that serialises the whole app. WAL lets readers run while one
  // writer is active; busy_timeout waits instead of failing fast on contention;
  // synchronous=NORMAL is safe under WAL and avoids an fsync per statement. WAL is
  // persisted in the DB file; the timeouts are per-connection (one per client).
  void (async () => {
    try {
      await client.$queryRawUnsafe("PRAGMA journal_mode = WAL");
      await client.$queryRawUnsafe("PRAGMA busy_timeout = 5000");
      await client.$queryRawUnsafe("PRAGMA synchronous = NORMAL");
      await client.$queryRawUnsafe("PRAGMA wal_autocheckpoint = 1000");
    } catch {
      // best-effort tuning; the app still works on the default journal
    }
  })();
  return client;
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
