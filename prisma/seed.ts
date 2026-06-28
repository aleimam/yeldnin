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
  { key: "cs_quality", route: "/cs-quality", section: "main", sortOrder: 11 },
  { key: "settings", route: "/settings", section: "admin", sortOrder: 12 },
  { key: "user_access", route: "/users", section: "admin", sortOrder: 13 },
  { key: "audit_log", route: "/audit", section: "admin", sortOrder: 14 },
  { key: "error_log", route: "/error-log", section: "admin", sortOrder: 15 },
  { key: "documents", route: "/documents", section: "admin", sortOrder: 16 },
];

// Starter document categories (admin-editable afterwards). Seeded by name (idempotent).
const DOC_CATEGORIES = ["Policies", "SOP", "Human Resources", "KPIs", "Information", "Report", "Release"];

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
  // Platform settings (single row, id=1). Version is admin-managed now — the
  // seed no longer clobbers it; it only migrates the old "1.2" default to "1.18"
  // once and fills the copyright placeholders if they're still empty.
  await prisma.platformSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, appName: "YeldnIN", version: "1.18" },
  });
  await prisma.platformSettings.updateMany({ where: { version: "1.2" }, data: { version: "1.18" } });
  await prisma.platformSettings.updateMany({ where: { copyrightEn: null }, data: { copyrightEn: "© Yeldn Health. All rights reserved." } });
  await prisma.platformSettings.updateMany({ where: { copyrightAr: null }, data: { copyrightAr: "© يلدن هيلث. جميع الحقوق محفوظة." } });

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

  // Starter document categories — created once by name; never clobbers later edits.
  for (let i = 0; i < DOC_CATEGORIES.length; i++) {
    const name = DOC_CATEGORIES[i];
    const existing = await prisma.documentCategory.findFirst({ where: { name } });
    if (!existing) await prisma.documentCategory.create({ data: { name, sortOrder: i } });
  }

  // CS Quality access bridge: CS is governed by the per-user cs_quality module
  // level, so seed sensible defaults from team membership — Sales → VIEW (see own
  // evals + criteria), Development → OPERATE (evaluate calls) — so existing
  // reps/evaluators aren't locked out by the new matrix. Fills only users with no
  // cs_quality permission yet, so manual grants survive re-seed (admins get
  // MANAGE via tier). New users added later need a grant via Settings → Access.
  const csTeams = await prisma.team.findMany({
    where: { key: { in: ["sales", "development"] } },
    include: { members: { select: { userId: true } } },
  });
  const csLevel = new Map<number, "VIEW" | "OPERATE">();
  for (const team of csTeams) {
    const lvl = team.key === "development" ? "OPERATE" : "VIEW";
    for (const m of team.members) {
      const cur = csLevel.get(m.userId);
      if (!cur || (cur === "VIEW" && lvl === "OPERATE")) csLevel.set(m.userId, lvl); // OPERATE wins
    }
  }
  let csGranted = 0;
  for (const [userId, level] of csLevel) {
    const existing = await prisma.userModulePermission.findFirst({ where: { userId, moduleKey: "cs_quality" } });
    if (!existing) {
      await prisma.userModulePermission.create({ data: { userId, moduleKey: "cs_quality", level } });
      csGranted++;
    }
  }
  if (csGranted) console.log(`  Granted cs_quality access to ${csGranted} team member(s).`);

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
  const CS_TYPES: { scope: string; types: { name: string; nameAr: string }[] }[] = [
    { scope: "CALL", types: [{ name: "Normal", nameAr: "عادية" }, { name: "Orders", nameAr: "طلبات" }, { name: "Problems", nameAr: "مشاكل" }] },
    { scope: "PERFORMANCE", types: [{ name: "Attitude", nameAr: "السلوك" }, { name: "Effort", nameAr: "الجهد" }, { name: "Time", nameAr: "الوقت" }] },
  ];
  for (const grp of CS_TYPES) {
    for (let i = 0; i < grp.types.length; i++) {
      const { name, nameAr } = grp.types[i];
      const found = await prisma.csEvalType.findFirst({ where: { scope: grp.scope, name } });
      if (!found) await prisma.csEvalType.create({ data: { scope: grp.scope, name, nameAr, sortOrder: i } });
      else if (!found.nameAr) await prisma.csEvalType.update({ where: { id: found.id }, data: { nameAr } });
    }
  }

  // Translate common evaluation-type names to Arabic on any existing type that
  // has no Arabic name yet (covers renamed variants like "Normal Call"). Fills
  // only — never creates — so it's safe against admin renames (no duplicates).
  const TYPE_AR: Record<string, string> = {
    "Normal": "عادية", "Normal Call": "مكالمة عادية",
    "Orders": "طلبات", "Order": "طلب", "Order Call": "مكالمة طلب",
    "Problems": "مشاكل", "Problem": "مشكلة", "Problem Call": "مكالمة مشكلة",
    "Attitude": "السلوك", "Effort": "الجهد", "Time": "الوقت",
  };
  let typesTranslated = 0;
  for (const [name, nameAr] of Object.entries(TYPE_AR)) {
    const res = await prisma.csEvalType.updateMany({ where: { name, nameAr: null }, data: { nameAr } });
    typesTranslated += res.count;
  }
  if (typesTranslated) console.log(`  Translated ${typesTranslated} evaluation-type name(s) to Arabic.`);

  // Recompute stored normalized % for existing evaluations under the current
  // rule (Perfect value = 100% ceiling, unclamped). Idempotent — writes only on
  // change. Uses the current answer-value config's PERFECT per scope.
  {
    const cfgRow = await prisma.csConfig.findUnique({ where: { id: 1 } });
    let cfg: { call?: Record<string, number>; performance?: Record<string, number> } = {};
    try {
      cfg = cfgRow ? JSON.parse(cfgRow.config || "{}") : {};
    } catch {
      cfg = {};
    }
    const perfectFor = (scope: string) => {
      const m = scope === "CALL" ? cfg.call : cfg.performance;
      return m && typeof m.PERFECT === "number" ? m.PERFECT : 1;
    };
    const evals = await prisma.csEvaluation.findMany({
      where: { archivedAt: null },
      include: { answers: { select: { value: true, weight: true } } },
    });
    let recomputed = 0;
    for (const ev of evals) {
      const sumW = ev.answers.reduce((s, a) => s + a.weight, 0);
      const ceiling = perfectFor(ev.scope) * sumW;
      const total = ev.answers.reduce((s, a) => s + a.value * a.weight, 0);
      const normalized = ceiling > 0 ? Math.round((total / ceiling) * 10000) / 100 : 0;
      if (normalized !== ev.normalized) {
        await prisma.csEvaluation.update({ where: { id: ev.id }, data: { normalized } });
        recomputed++;
      }
    }
    if (recomputed) console.log(`  Recomputed normalized % for ${recomputed} evaluation(s).`);
  }

  // Backfill Arabic snapshots onto existing evaluation answers from the current
  // question/type. Idempotent: only fills a blank when the source has Arabic, so
  // it becomes a no-op once everything is filled (and fills in over time as
  // admins add Arabic to the question pool and the seed re-runs on deploy).
  {
    const answers = await prisma.csEvaluationAnswer.findMany({
      where: { OR: [{ titleAr: null }, { criteriaAr: null }, { typeNameAr: null }] },
      select: { id: true, questionId: true, titleAr: true, criteriaAr: true, typeNameAr: true },
    });
    const qIds = [...new Set(answers.map((a) => a.questionId))];
    const questions = qIds.length
      ? await prisma.csQuestion.findMany({
          where: { id: { in: qIds } },
          select: { id: true, titleAr: true, criteriaAr: true, type: { select: { nameAr: true } } },
        })
      : [];
    const qMap = new Map(questions.map((q) => [q.id, q]));
    let filled = 0;
    for (const a of answers) {
      const q = qMap.get(a.questionId);
      if (!q) continue;
      const data: { titleAr?: string; criteriaAr?: string; typeNameAr?: string } = {};
      if (a.titleAr == null && q.titleAr) data.titleAr = q.titleAr;
      if (a.criteriaAr == null && q.criteriaAr) data.criteriaAr = q.criteriaAr;
      if (a.typeNameAr == null && q.type?.nameAr) data.typeNameAr = q.type.nameAr;
      if (Object.keys(data).length) {
        await prisma.csEvaluationAnswer.update({ where: { id: a.id }, data });
        filled++;
      }
    }
    if (filled) console.log(`  Backfilled Arabic on ${filled} evaluation answer(s).`);
  }

  // Default super-admin (only if there are no users at all)
  const userCount = await prisma.user.count();
  if (userCount === 0) {
    const email = "admin@yeldn.local";
    const password = "ChangeMe!2026";
    const passwordHash = await bcrypt.hash(password, 12);
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
    console.log(`    password: (the documented default — change it after first login)\n`);
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

  // HR: strict 1:1 — ensure every user has an Employee record (idempotent backfill).
  const usersNoEmp = await prisma.user.findMany({ where: { employee: { is: null } }, select: { id: true } });
  for (const u of usersNoEmp) {
    const emp = await prisma.employee.create({ data: { userId: u.id } });
    await prisma.employeeEvent.create({ data: { employeeId: emp.id, type: "CREATED", message: "Employee record created." } });
  }
  if (usersNoEmp.length) console.log(`  Backfilled ${usersNoEmp.length} employee record(s).`);

  // HR: assign a YE#### employee number (User.uid) to every employee's user that
  // lacks one. Admins draw from the 1001 band, staff from 1101, in employee-id
  // order. Idempotent — skips users that already have a valid number.
  const empUsers = await prisma.user.findMany({
    where: { employee: { isNot: null } },
    select: { id: true, uid: true, tier: true },
    orderBy: { id: "asc" },
  });
  const usedNums = new Set(
    (await prisma.user.findMany({ where: { uid: { not: null } }, select: { uid: true } })).map((u) => u.uid as string),
  );
  const numValue = (u: string | null) => {
    const m = /^YE(\d{3,})$/.exec((u ?? "").trim());
    return m ? Number(m[1]) : null;
  };
  let numbered = 0;
  for (const u of empUsers) {
    if (u.uid && /^YE\d{3,}$/.test(u.uid)) continue;
    const admin = u.tier === "ADMIN" || u.tier === "SUPER_ADMIN";
    const nums = [...usedNums].map(numValue).filter((n): n is number => n != null);
    const band = admin ? nums.filter((n) => n >= 1001 && n < 1101) : nums.filter((n) => n >= 1101);
    let next = band.length ? Math.max(...band) + 1 : admin ? 1001 : 1101;
    while (usedNums.has(`YE${next}`)) next++;
    const num = `YE${next}`;
    await prisma.user.update({ where: { id: u.id }, data: { uid: num } });
    usedNums.add(num);
    numbered++;
  }
  if (numbered) console.log(`  Assigned ${numbered} employee number(s).`);

  // HR day types (system catalog; idempotent — never overwrites admin edits).
  const DAY_TYPES = [
    { code: "ANNUAL", name: "Annual leave", nameAr: "إجازة اعتيادية", dayClass: "LEAVE", sortOrder: 1 },
    { code: "URGENT", name: "Urgent leave", nameAr: "إجازة طارئة", dayClass: "LEAVE", sortOrder: 2 },
    { code: "ED", name: "Eid Duty", nameAr: "مناوبة عيد", dayClass: "DUTY", sortOrder: 3 },
    { code: "D", name: "Duty", nameAr: "مناوبة", dayClass: "DUTY", sortOrder: 4 },
    { code: "VD", name: "Vacation Duty", nameAr: "مناوبة إجازة", dayClass: "DUTY", sortOrder: 5 },
    { code: "L", name: "Learning", nameAr: "تدريب", dayClass: "DUTY", sortOrder: 6 },
  ];
  for (const dt of DAY_TYPES) {
    await prisma.dayType.upsert({ where: { code: dt.code }, update: {}, create: { ...dt, system: true } });
  }

  // HR salary components (system catalog; idempotent — never overwrites admin edits).
  const SALARY_COMPONENTS = [
    { code: "BASIC", name: "Basic Salary", nameAr: "الراتب الأساسي", kind: "EARNING", valuation: "FIXED_MONTHLY", sortOrder: 1 },
    { code: "MTARGET", name: "Monthly Target Bonus", nameAr: "مكافأة الهدف الشهري", kind: "BONUS", valuation: "FIXED_EVENT", sortOrder: 2 },
    { code: "QTARGET", name: "Quarter Target Bonus", nameAr: "مكافأة الهدف الربع سنوي", kind: "BONUS", valuation: "FIXED_EVENT", sortOrder: 3 },
    { code: "WEID", name: "Working in Eid Bonus", nameAr: "مكافأة العمل في العيد", kind: "BONUS", valuation: "PER_DAY_FIXED", sortOrder: 4 },
    { code: "WVAC", name: "Working in Vacation Bonus", nameAr: "مكافأة العمل في الإجازة", kind: "BONUS", valuation: "PER_DAY_FIXED", sortOrder: 5 },
  ];
  for (const sc of SALARY_COMPONENTS) {
    await prisma.salaryComponent.upsert({ where: { code: sc.code }, update: {}, create: { ...sc, system: true } });
  }
  // Wire the obvious duty→bonus links once (only when still unset, to respect admin choices).
  const byCode = Object.fromEntries((await prisma.salaryComponent.findMany({ select: { id: true, code: true } })).map((c) => [c.code, c.id]));
  for (const [dayCode, compCode] of [["ED", "WEID"], ["VD", "WVAC"]] as const) {
    const dt = await prisma.dayType.findUnique({ where: { code: dayCode }, select: { id: true, bonusComponentId: true } });
    if (dt && dt.bonusComponentId == null && byCode[compCode]) {
      await prisma.dayType.update({ where: { id: dt.id }, data: { bonusComponentId: byCode[compCode] } });
    }
  }

  // HR salary types (admin-editable; label only). Seeded once, never overwritten.
  const SALARY_TYPES = [
    { code: "FIXED", name: "Fixed Salary", nameAr: "راتب ثابت", sortOrder: 1 },
    { code: "KPI", name: "KPI", nameAr: "مؤشرات الأداء", sortOrder: 2 },
    { code: "PROFIT", name: "Profit Share", nameAr: "حصة من الأرباح", sortOrder: 3 },
  ];
  for (const s of SALARY_TYPES) {
    await prisma.salaryType.upsert({ where: { code: s.code }, update: {}, create: s });
  }

  // HR employee types (admin-editable). payrollEligible decides who the payroll
  // run includes — only Staff are paid by us. Seeded once, never overwritten.
  const EMPLOYEE_TYPES = [
    { code: "STAFF_FT", name: "Full-time Staff", nameAr: "موظف دوام كامل", payrollEligible: true, sortOrder: 1 },
    { code: "STAFF_PT", name: "Part-time Staff", nameAr: "موظف دوام جزئي", payrollEligible: true, sortOrder: 2 },
    { code: "SHAREHOLDER", name: "Shareholder", nameAr: "مساهم", payrollEligible: false, sortOrder: 3 },
    { code: "SISTER", name: "Sister Company", nameAr: "شركة شقيقة", payrollEligible: false, sortOrder: 4 },
    { code: "THIRD_PARTY", name: "Third Party", nameAr: "طرف ثالث", payrollEligible: false, sortOrder: 5 },
  ];
  for (const e of EMPLOYEE_TYPES) {
    await prisma.employeeType.upsert({ where: { code: e.code }, update: {}, create: e });
  }

  // Inquiry close dispositions (admin-editable; seed the three defaults once).
  const DISPOSITIONS = [
    { key: "solved", label: "Solved", labelAr: "تم الحل", sortOrder: 1 },
    { key: "not_answered", label: "Not Answered", labelAr: "لم يُجب", sortOrder: 2 },
    { key: "no_need", label: "No Need", labelAr: "لا حاجة", sortOrder: 3 },
  ];
  for (const d of DISPOSITIONS) {
    await prisma.inquiryDisposition.upsert({ where: { key: d.key }, update: {}, create: d });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
