// Idempotent foundation seed: platform settings, module registry, teams,
// and a default super-admin (only if no users exist — never resets a password).
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaNodeSQLite } from "prisma-adapter-node-sqlite";
import bcrypt from "bcryptjs";

const adapter = new PrismaNodeSQLite({
  url: `file:${path.join(process.cwd(), "prisma", "dev.db")}`,
});
const prisma = new PrismaClient({ adapter });

const MODULES = [
  { key: "egv_pricer", route: "/pricer", section: "main", sortOrder: 1 },
  { key: "expenses", route: "/expenses", section: "main", sortOrder: 2 },
  { key: "order_requests", route: "/sales", section: "main", sortOrder: 3 },
  { key: "xoonx", route: "/xoonx", section: "main", sortOrder: 4 },
  { key: "purchasing", route: "/purchasing", section: "main", sortOrder: 5 },
  { key: "logistics", route: "/logistics", section: "main", sortOrder: 6 },
  { key: "operations", route: "/operations", section: "main", sortOrder: 7 },
  { key: "couriers", route: "/couriers", section: "main", sortOrder: 8 },
  { key: "issues", route: "/issues", section: "main", sortOrder: 9 },
  { key: "history", route: "/history", section: "main", sortOrder: 10 },
  { key: "settings", route: "/settings", section: "admin", sortOrder: 11 },
  { key: "user_access", route: "/users", section: "admin", sortOrder: 12 },
];

const TEAMS = [
  { key: "sales", name: "Sales" },
  { key: "xoonx", name: "XOONX" },
  { key: "purchasing", name: "Purchasing" },
  { key: "logistics", name: "Logistics" },
  { key: "operations", name: "Operations" },
  { key: "couriers", name: "Couriers" },
  { key: "development", name: "Development" },
];

async function main() {
  // Platform settings (single row, id=1)
  await prisma.platformSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, appName: "YeldnIN", version: "0.1.0" },
  });

  // Module registry
  for (const m of MODULES) {
    await prisma.module.upsert({
      where: { key: m.key },
      update: { route: m.route, section: m.section, sortOrder: m.sortOrder },
      create: m,
    });
  }

  // Teams
  for (const team of TEAMS) {
    await prisma.team.upsert({
      where: { key: team.key },
      update: { name: team.name },
      create: team,
    });
  }

  // Expense categories + accounts (idempotent by name)
  const EXPENSE_CATEGORIES: { name: string; type: string }[] = [
    { name: "Charity", type: "EXPENSE" },
    { name: "Delivery Costs", type: "EXPENSE" },
    { name: "Transportation", type: "EXPENSE" },
    { name: "Communications", type: "EXPENSE" },
    { name: "Packing Costs", type: "EXPENSE" },
    { name: "Tips", type: "EXPENSE" },
    { name: "Tagamoa Office", type: "EXPENSE" },
    { name: "Alf Maskan Office", type: "EXPENSE" },
    { name: "Quarterly Meeting", type: "EXPENSE" },
    { name: "Money Handover", type: "TRANSFER" },
    { name: "Gifts", type: "EXPENSE" },
    { name: "Other", type: "EXPENSE" },
  ];
  for (let i = 0; i < EXPENSE_CATEGORIES.length; i++) {
    const c = EXPENSE_CATEGORIES[i];
    const found = await prisma.expenseCategory.findFirst({ where: { name: c.name } });
    if (!found) {
      await prisma.expenseCategory.create({ data: { name: c.name, type: c.type, sortOrder: i } });
    }
  }

  const EXPENSE_ACCOUNTS = [
    "Alex Bank",
    "Banque Misr",
    "CIB Personal Account",
    "CIB Business Account",
    "Mobile Wallet",
    "Other Accounts",
  ];
  for (let i = 0; i < EXPENSE_ACCOUNTS.length; i++) {
    const name = EXPENSE_ACCOUNTS[i];
    const found = await prisma.expenseAccount.findFirst({ where: { name } });
    if (!found) await prisma.expenseAccount.create({ data: { name, sortOrder: i } });
  }

  // Default super-admin (only if there are no users at all)
  const userCount = await prisma.user.count();
  if (userCount === 0) {
    const email = "admin@yeldn.local";
    const password = "ChangeMe!2026";
    const passwordHash = await bcrypt.hash(password, 10);
    const admin = await prisma.user.create({
      data: {
        name: "Administrator",
        email,
        passwordHash,
        tier: "SUPER_ADMIN",
        locale: "en",
      },
    });
    // Grant MANAGE on every module to the super-admin.
    for (const m of MODULES) {
      await prisma.userModulePermission.create({
        data: { userId: admin.id, moduleKey: m.key, level: "MANAGE" },
      });
    }
    console.log(`\n  Seeded default super-admin:`);
    console.log(`    email:    ${email}`);
    console.log(`    password: ${password}  (change after first login)\n`);
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
