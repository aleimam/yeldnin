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
  { key: "pricing", route: "/pricing", section: "main", sortOrder: 1 },
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
  { key: "audit_log", route: "/audit", section: "admin", sortOrder: 13 },
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

  // One-time rename: egv_pricer -> pricing (module key, permissions, audit). Idempotent.
  await prisma.module.deleteMany({ where: { key: "egv_pricer" } });
  await prisma.userModulePermission.updateMany({
    where: { moduleKey: "egv_pricer" },
    data: { moduleKey: "pricing" },
  });
  await prisma.auditLog.updateMany({
    where: { moduleKey: "egv_pricer" },
    data: { moduleKey: "pricing" },
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

  // Countries (idempotent by name). Seeds the legacy regions; admins add more.
  const COUNTRIES = ["USA", "UK", "EU"];
  for (let i = 0; i < COUNTRIES.length; i++) {
    const name = COUNTRIES[i];
    const found = await prisma.country.findFirst({ where: { name } });
    if (!found) await prisma.country.create({ data: { name, sortOrder: i } });
  }

  // CS Quality evaluation types (idempotent). Both lists are admin-editable.
  const CS_TYPES: { scope: string; names: string[] }[] = [
    { scope: "CALL", names: ["Normal", "Orders", "Problems"] },
    { scope: "PERFORMANCE", names: ["Attitude", "Effort", "Time"] },
  ];
  for (const grp of CS_TYPES) {
    for (let i = 0; i < grp.names.length; i++) {
      const name = grp.names[i];
      const found = await prisma.csEvalType.findFirst({ where: { scope: grp.scope, name } });
      if (!found) await prisma.csEvalType.create({ data: { scope: grp.scope, name, sortOrder: i } });
    }
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

  // Starter footer pages (drafts) — only if none exist yet.
  if ((await prisma.contentPage.count()) === 0) {
    const adminId =
      (await prisma.user.findFirst({ where: { tier: "SUPER_ADMIN" }, select: { id: true } }))?.id ??
      (await prisma.user.findFirst({ select: { id: true } }))?.id;
    if (adminId) {
      const starters = [
        { slug: "about", titleEn: "About Yeldn Health", titleAr: "عن يلدن هيلث" },
        { slug: "contact", titleEn: "Contact Us", titleAr: "اتصل بنا" },
        { slug: "privacy", titleEn: "Privacy Policy", titleAr: "سياسة الخصوصية" },
        { slug: "terms", titleEn: "Terms of Service", titleAr: "شروط الخدمة" },
      ];
      for (let i = 0; i < starters.length; i++) {
        const s = starters[i];
        await prisma.contentPage.create({
          data: {
            slug: s.slug,
            titleEn: s.titleEn,
            titleAr: s.titleAr,
            bodyEn: `# ${s.titleEn}\n\n_Draft — edit this page in Settings → Pages, then publish._`,
            bodyAr: `# ${s.titleAr}\n\n_مسودة — حرّر هذه الصفحة من الإعدادات ← الصفحات ثم انشرها._`,
            visibility: "PUBLIC",
            published: false, // drafts; publish to show in the footer
            showInFooter: true,
            showInMenu: true,
            sortOrder: i + 1,
            createdById: adminId,
          },
        });
      }
    }
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
