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
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
