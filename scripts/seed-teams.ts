import "dotenv/config";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaNodeSQLite } from "prisma-adapter-node-sqlite";

// Not `@/lib/db` — that module opens with `import "server-only"`, which throws
// in any CLI.
const prisma = new PrismaClient({ adapter: new PrismaNodeSQLite({ url: `file:${path.join(process.cwd(), "prisma", "dev.db")}` }) });

/**
 * Create the teams Veeey has permission groups for but YeldnIN never had, so the
 * two systems can be 1:1 and the sync needs no mapping table.
 *
 *   npx tsx scripts/seed-teams.ts            # DRY RUN
 *   npx tsx scripts/seed-teams.ts --commit
 *
 * Empty teams grant nobody anything, so creating them is inert — the access
 * change happens only when members are added, which is a human decision.
 */
const TEAMS = [
  { key: "marketing", name: "Marketing" },
  { key: "finance", name: "Finance" },
  { key: "content_seo", name: "Content / SEO" },
  { key: "support", name: "Customer Support" },
] as const;

async function main() {
  const commit = process.argv.includes("--commit");
  console.log(`\n=== seed teams — ${commit ? "COMMIT" : "DRY RUN"} ===\n`);
  for (const t of TEAMS) {
    const existing = await prisma.team.findUnique({ where: { key: t.key } });
    if (existing) { console.log(`  ${t.key.padEnd(14)} already exists`); continue; }
    console.log(`  ${t.key.padEnd(14)} CREATE  "${t.name}"`);
    if (commit) await prisma.team.create({ data: { key: t.key, name: t.name } });
  }
  const all = await prisma.team.findMany({ orderBy: { key: "asc" }, include: { _count: { select: { members: true } } } });
  console.log(`\n  teams now: ${all.map((t) => `${t.key}(${t._count.members})`).join(" ")}`);
  console.log(commit ? "\n✅ applied.\n" : "\nℹ️ DRY RUN — nothing written.\n");
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
