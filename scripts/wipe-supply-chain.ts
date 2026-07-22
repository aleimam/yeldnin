import "dotenv/config";
import path from "node:path";
import { copyFileSync, existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PrismaNodeSQLite } from "prisma-adapter-node-sqlite";

// Deliberately NOT `@/lib/db`: that module starts with `import "server-only"`,
// which throws the moment a CLI loads it. Same client, built here.
const DB_FILE = path.join(process.cwd(), "prisma", "dev.db");
const prisma = new PrismaClient({ adapter: new PrismaNodeSQLite({ url: `file:${DB_FILE}` }) });

/**
 * Wipe the supply-chain and Veeey-mirror TRANSACTIONS, before reloading real
 * data from egyptvitamins.net.
 *
 *   npx tsx scripts/wipe-supply-chain.ts             # DRY RUN — counts only
 *   npx tsx scripts/wipe-supply-chain.ts --commit    # takes a DB copy first
 *
 * THE LINE THIS DRAWS. Owner's instruction was "wipe supply chain only; never
 * departments, users or employees and their related details". Two refinements
 * came out of reading the schema, both erring toward keeping:
 *
 *  - **Reference data stays.** Suppliers, hubs, carriers and travellers are
 *    named business entities, not test transactions. Deleting them would mean
 *    re-entering the supply chain's master data by hand — the same loss the
 *    config export exists to prevent.
 *  - **Couriers stay.** `Courier` carries a userId for "Ops staff who are also
 *    couriers", so wiping it would cut into staff records.
 *
 * Everything HR, finance, CS-evaluation, document, engagement and audit is
 * untouched — none of it can be rebuilt from egyptvitamins.net.
 */

/** Children first: SQLite will refuse a parent whose rows are still referenced. */
const WIPE_ORDER = [
  // Outbound deliveries — they reference customers, so they cannot outlive them.
  "deliveryEvent", "deliveryPhoto", "deliveryLine", "delivery",
  // Issues + compensation hang off trips/items/shipments.
  "issueItem", "issuePhoto", "compensation", "issue",
  // Inbound stock-in.
  "shipmentPhoto", "itemEvent", "item", "shipment",
  "patchPhoto", "patch",
  "transferPhoto", "transfer",
  "purchase",
  "requestPhoto", "requestLine", "request",
  // Trips carry shipments; marks hang off trips.
  "tripMarkPhoto", "tripMark", "trip",
  // The Veeey mirror.
  "productPhoto", "product", "customer",
  // Replay-protection caches — pure churn, safe and large.
  "integrationNonce", "idempotencyRecord", "outboxEvent",
] as const;

/** Never touched. Listed explicitly so the intent is auditable, not implied. */
const PROTECTED = [
  "user", "team", "teamMember", "role", "permission", "rolePermission", "userRole", "teamRole",
  "userModulePermission", "module", "employee", "employeeEvent", "employeePhoto", "position",
  "salaryComponent", "salaryStructureLine", "salaryChange", "payslip", "payslipLine",
  "leaveRequest", "absence", "holiday", "holidayBonus", "dutyDay", "hrConfig",
  "csEvaluation", "csEvaluationAnswer", "csEvaluationPhoto", "csQuestion", "csBonusTier", "csEvalType",
  "expenseTransaction", "expenseCategory", "expenseAttachment", "expenseAccount",
  "document", "documentVersion", "documentPermission", "documentAck",
  "auditLog", "asset", "counter", "platformSettings", "contentPage",
  // Supply-chain REFERENCE data — named entities, not transactions.
  "supplier", "hub", "carrier", "traveler", "courier",
] as const;

async function main() {
  const commit = process.argv.includes("--commit");
  const db = DB_FILE;

  console.log(`\n=== YeldnIN supply-chain wipe — ${commit ? "COMMIT" : "DRY RUN (no deletes)"} ===\n`);

  const client = prisma as unknown as Record<string, { count?: () => Promise<number>; deleteMany?: () => Promise<{ count: number }> }>;
  let total = 0;
  const plan: [string, number][] = [];
  for (const m of WIPE_ORDER) {
    const c = client[m];
    if (!c?.count) { console.log(`  ${m.padEnd(24)} — model not found, skipped`); continue; }
    const n = await c.count();
    plan.push([m, n]);
    total += n;
  }
  for (const [m, n] of plan) if (n > 0) console.log(`  ${m.padEnd(24)} ${String(n).padStart(8)}`);
  console.log(`\n  would delete ${total} row(s) across ${plan.filter(([, n]) => n > 0).length} table(s)`);

  console.log(`\n  PROTECTED — untouched (${PROTECTED.length} tables incl. users, employees, HR, finance, CS, documents):`);
  let kept = 0;
  for (const m of PROTECTED) {
    const c = client[m];
    if (c?.count) kept += await c.count();
  }
  console.log(`    ${kept} row(s) preserved`);

  if (!commit) { console.log("\nℹ️ DRY RUN — nothing deleted. Re-run with --commit.\n"); await prisma.$disconnect(); return; }

  // A file copy is the whole rollback for SQLite, and it costs seconds. Never
  // delete without one.
  if (existsSync(db)) {
    const backup = `${db}.before-wipe-${new Date().toISOString().slice(0, 10)}`;
    copyFileSync(db, backup);
    console.log(`\n  📦 database copied to ${backup}`);
  } else {
    console.log(`\n  ⚠️ could not find ${db} to back up — ABORTING`);
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log("\n  deleting…");
  for (const m of WIPE_ORDER) {
    const c = client[m];
    if (!c?.deleteMany) continue;
    const r = await c.deleteMany();
    if (r.count) console.log(`    ${m.padEnd(24)} ${String(r.count).padStart(8)} deleted`);
  }
  console.log("\n✅ done. Reload the catalog from egyptvitamins.net, then re-run the staff sync.\n");
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
