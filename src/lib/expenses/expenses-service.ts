import "server-only";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { getLocale } from "@/i18n/server";
import { displayName } from "@/lib/users/users-logic";
import type { Access, SessionUser } from "@/lib/auth/access";
import {
  canEditExpense,
  canDeleteExpense,
  computeReconciliation,
  reconciliationStatus,
  type ReconciliationResult,
} from "./expenses-logic";

type AuthedAccess = Access & { user: SessionUser };

// Capability-backed helpers (admins inherit everything via access.can()).
// editAny = edit/delete any entry with no time window; editOwn = own within
// the window; deleteTxn = delete any entry.
export function canEditAnyExpense(access: AuthedAccess): boolean {
  return access.can("expenses", "editAny");
}
export function canEditOwnExpense(access: AuthedAccess): boolean {
  return access.can("expenses", "editOwn");
}
export function canDeleteAnyExpense(access: AuthedAccess): boolean {
  return access.can("expenses", "deleteTxn");
}
/** Flag/unflag a transaction for review — admins/managers only; operate users only see flags. */
export function canFlagExpense(access: AuthedAccess): boolean {
  return access.can("expenses", "flagTxn");
}

export function monthRange(year: number, month: number): { gte: Date; lt: Date } {
  return { gte: new Date(year, month - 1, 1), lt: new Date(year, month, 1) };
}

/** Parse a YYYY-MM-DD string to UTC-midnight (date-only), or null. */
function utcDateOnly(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function userNameMap(
  ids: (number | null | undefined)[],
): Promise<Map<number, string>> {
  const clean = [...new Set(ids.filter((x): x is number => typeof x === "number"))];
  if (!clean.length) return new Map();
  const [locale, users] = await Promise.all([
    getLocale(),
    prisma.user.findMany({
      where: { id: { in: clean } },
      select: { id: true, name: true, nameAr: true },
    }),
  ]);
  return new Map(users.map((u) => [u.id, displayName(u, locale)]));
}

async function categorySnapshot(categoryId: number): Promise<{ name: string; type: string }> {
  const c = await prisma.expenseCategory.findUnique({ where: { id: categoryId } });
  if (!c) throw new Error("Category not found");
  return { name: c.name, type: c.type };
}

// ---------------- Transactions ----------------

export async function createExpenseTransaction(
  input: { amount: number; categoryId: number; note?: string | null; accruingDate?: string | null; attachmentAssetIds?: string[] },
  access: AuthedAccess,
) {
  const snap = await categorySnapshot(input.categoryId);
  const tx = await prisma.expenseTransaction.create({
    data: {
      amount: input.amount,
      categoryId: input.categoryId,
      categoryNameSnapshot: snap.name,
      categoryTypeSnapshot: snap.type,
      note: input.note || null,
      accruingDate: utcDateOnly(input.accruingDate) ?? new Date(),
      createdById: access.user.id,
      attachments: input.attachmentAssetIds?.length
        ? { create: input.attachmentAssetIds.map((assetId) => ({ assetId, uploadedById: access.user.id })) }
        : undefined,
    },
  });
  await writeAudit(access.user.id, "expenses", "expense.tx.create", "expenseTransaction", tx.id, {
    amount: tx.amount,
    category: snap.name,
    type: snap.type,
  });
  return tx;
}

export async function updateExpenseTransaction(
  id: number,
  input: { amount: number; categoryId: number; note?: string | null; accruingDate?: string | null },
  access: AuthedAccess,
) {
  const tx = await prisma.expenseTransaction.findUnique({ where: { id } });
  if (!tx) throw new Error("Transaction not found");
  if (
    !canEditExpense({
      isManager: canEditAnyExpense(access),
      isOwner: tx.createdById === access.user.id,
      hasEditPermission: canEditOwnExpense(access),
      createdAt: tx.createdAt,
      now: new Date(),
    })
  ) {
    throw new Error("Not allowed to edit this transaction");
  }

  const snap = await categorySnapshot(input.categoryId);
  const newAccruing = utcDateOnly(input.accruingDate);
  const changes: { field: string; old: unknown; new: unknown }[] = [];
  if (tx.amount !== input.amount) changes.push({ field: "amount", old: tx.amount, new: input.amount });
  if (tx.categoryNameSnapshot !== snap.name) changes.push({ field: "category", old: tx.categoryNameSnapshot, new: snap.name });
  if ((tx.note || "") !== (input.note || "")) changes.push({ field: "note", old: tx.note, new: input.note });
  if (newAccruing && tx.accruingDate?.getTime() !== newAccruing.getTime()) {
    changes.push({ field: "accruingDate", old: tx.accruingDate, new: newAccruing });
  }

  const updated = await prisma.expenseTransaction.update({
    where: { id },
    data: {
      amount: input.amount,
      categoryId: input.categoryId,
      categoryNameSnapshot: snap.name,
      categoryTypeSnapshot: snap.type,
      note: input.note || null,
      ...(newAccruing ? { accruingDate: newAccruing } : {}),
      updatedById: access.user.id,
    },
  });
  await writeAudit(access.user.id, "expenses", "expense.tx.update", "expenseTransaction", id, { changes });
  return updated;
}

export async function deleteExpenseTransaction(id: number, access: AuthedAccess) {
  const tx = await prisma.expenseTransaction.findUnique({ where: { id }, include: { attachments: true } });
  if (!tx) return [];
  const allowed =
    canDeleteExpense({ isManager: canDeleteAnyExpense(access), hasDeletePermission: false }) ||
    canEditExpense({
      isManager: canEditAnyExpense(access),
      isOwner: tx.createdById === access.user.id,
      hasEditPermission: canEditOwnExpense(access),
      createdAt: tx.createdAt,
      now: new Date(),
    });
  if (!allowed) throw new Error("Not allowed to delete this transaction");
  await writeAudit(access.user.id, "expenses", "expense.tx.delete", "expenseTransaction", id, {
    amount: tx.amount,
    category: tx.categoryNameSnapshot,
  });
  await prisma.expenseTransaction.delete({ where: { id } });
  return tx.attachments.map((a) => a.assetId);
}

export function getTransaction(id: number) {
  return prisma.expenseTransaction.findUnique({
    where: { id },
    include: { createdBy: { select: { name: true, nameAr: true } }, attachments: true },
  });
}

const FLAGS = new Set(["RED", "YELLOW"]);

/** Set/change a transaction's review flag (RED|YELLOW), with an optional note for clarification. */
export async function setTransactionFlag(id: number, flag: string, note: string | null, access: AuthedAccess) {
  if (!FLAGS.has(flag)) throw new Error("Invalid flag");
  const tx = await prisma.expenseTransaction.update({
    where: { id },
    data: { flag, flagNote: note?.trim() || null, flaggedById: access.user.id, flaggedAt: new Date() },
  });
  await writeAudit(access.user.id, "expenses", "expense.tx.flag", "expenseTransaction", id, { flag, note: note?.trim() || null });
  return tx;
}

/** Clear a transaction's review flag. */
export async function clearTransactionFlag(id: number, access: AuthedAccess) {
  const tx = await prisma.expenseTransaction.update({
    where: { id },
    data: { flag: null, flagNote: null, flaggedById: null, flaggedAt: null },
  });
  await writeAudit(access.user.id, "expenses", "expense.tx.unflag", "expenseTransaction", id);
  return tx;
}

export type TxSort = "accruing_desc" | "accruing_asc" | "registered_desc" | "registered_asc" | "amount_desc" | "amount_asc";
export type TxFlagFilter = "RED" | "YELLOW" | "NONE" | "ANY";

function txOrderBy(sort: TxSort | undefined) {
  switch (sort) {
    case "accruing_asc": return [{ accruingDate: "asc" as const }, { createdAt: "asc" as const }];
    case "registered_desc": return [{ createdAt: "desc" as const }];
    case "registered_asc": return [{ createdAt: "asc" as const }];
    case "amount_desc": return [{ amount: "desc" as const }];
    case "amount_asc": return [{ amount: "asc" as const }];
    default: return [{ accruingDate: "desc" as const }, { createdAt: "desc" as const }]; // accruing_desc
  }
}

export async function listTransactions(opts: {
  type?: "EXPENSE" | "TRANSFER";
  categoryId?: number;
  flag?: TxFlagFilter;
  search?: string;
  sort?: TxSort;
  take?: number;
  skip?: number;
}) {
  const search = opts.search?.trim();
  const asNum = search && Number.isFinite(Number(search)) ? Number(search) : null;
  return prisma.expenseTransaction.findMany({
    where: {
      ...(opts.type ? { categoryTypeSnapshot: opts.type } : {}),
      ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
      ...(opts.flag === "NONE" ? { flag: null } : opts.flag === "RED" || opts.flag === "YELLOW" ? { flag: opts.flag } : opts.flag === "ANY" ? { flag: { not: null } } : {}),
      ...(search
        ? {
            OR: [
              { note: { contains: search } },
              { categoryNameSnapshot: { contains: search } },
              ...(asNum != null ? [{ amount: asNum }] : []),
            ],
          }
        : {}),
    },
    orderBy: txOrderBy(opts.sort),
    include: { createdBy: { select: { name: true, nameAr: true } }, attachments: true },
    take: opts.take ?? 200,
    skip: opts.skip ?? 0,
  });
}

// ---------------- Categories & accounts ----------------

export function listCategories(includeDisabled = false) {
  return prisma.expenseCategory.findMany({
    where: { deletedAt: null, ...(includeDisabled ? {} : { enabled: true }) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export function listAccounts(includeDisabled = false) {
  return prisma.expenseAccount.findMany({
    where: { deletedAt: null, ...(includeDisabled ? {} : { enabled: true }) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

// ---------------- Dashboard ----------------

export interface DashboardData {
  monthExpensesTotal: number;
  monthTransfersTotal: number;
  topCategories: { name: string; total: number }[];
  recentExpenses: { id: number; amount: number; categoryNameSnapshot: string; createdAt: Date; createdBy: string }[];
  recentDeliveries: { id: number; amount: number; categoryNameSnapshot: string; createdAt: Date; createdBy: string }[];
  byMonth: { label: string; expenses: number; transfers: number }[];
  latestReconciliation: { year: number; month: number; result: ReconciliationResult } | null;
}

export async function getExpensesDashboard(): Promise<DashboardData> {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const { gte, lt } = monthRange(y, m);

  const [locale, monthExp, monthTr, topCats, recentExp, recentDel] = await Promise.all([
    getLocale(),
    prisma.expenseTransaction.aggregate({ _sum: { amount: true }, where: { categoryTypeSnapshot: "EXPENSE", createdAt: { gte, lt } } }),
    prisma.expenseTransaction.aggregate({ _sum: { amount: true }, where: { categoryTypeSnapshot: "TRANSFER", createdAt: { gte, lt } } }),
    prisma.expenseTransaction.groupBy({
      by: ["categoryNameSnapshot"],
      where: { categoryTypeSnapshot: "EXPENSE", createdAt: { gte, lt } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 5,
    }),
    prisma.expenseTransaction.findMany({ where: { categoryTypeSnapshot: "EXPENSE" }, orderBy: { createdAt: "desc" }, take: 5, include: { createdBy: { select: { name: true, nameAr: true } } } }),
    prisma.expenseTransaction.findMany({ where: { categoryTypeSnapshot: "TRANSFER" }, orderBy: { createdAt: "desc" }, take: 5, include: { createdBy: { select: { name: true, nameAr: true } } } }),
  ]);

  const byMonth: DashboardData["byMonth"] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    const yy = d.getFullYear();
    const mm = d.getMonth() + 1;
    const range = monthRange(yy, mm);
    const [e, t] = await Promise.all([
      prisma.expenseTransaction.aggregate({ _sum: { amount: true }, where: { categoryTypeSnapshot: "EXPENSE", createdAt: { gte: range.gte, lt: range.lt } } }),
      prisma.expenseTransaction.aggregate({ _sum: { amount: true }, where: { categoryTypeSnapshot: "TRANSFER", createdAt: { gte: range.gte, lt: range.lt } } }),
    ]);
    byMonth.push({ label: `${yy}-${String(mm).padStart(2, "0")}`, expenses: e._sum.amount ?? 0, transfers: t._sum.amount ?? 0 });
  }

  const latestSales = await prisma.monthlySalesReport.findFirst({ orderBy: [{ year: "desc" }, { month: "desc" }] });
  let latestReconciliation: DashboardData["latestReconciliation"] = null;
  if (latestSales) {
    latestReconciliation = { year: latestSales.year, month: latestSales.month, result: await calculateMonthlyReconciliation(latestSales.year, latestSales.month) };
  }

  return {
    monthExpensesTotal: monthExp._sum.amount ?? 0,
    monthTransfersTotal: monthTr._sum.amount ?? 0,
    topCategories: topCats.map((c) => ({ name: c.categoryNameSnapshot, total: c._sum.amount ?? 0 })),
    recentExpenses: recentExp.map((r) => ({ id: r.id, amount: r.amount, categoryNameSnapshot: r.categoryNameSnapshot, createdAt: r.createdAt, createdBy: displayName(r.createdBy, locale) })),
    recentDeliveries: recentDel.map((r) => ({ id: r.id, amount: r.amount, categoryNameSnapshot: r.categoryNameSnapshot, createdAt: r.createdAt, createdBy: displayName(r.createdBy, locale) })),
    byMonth,
    latestReconciliation,
  };
}

// ---------------- Reports ----------------

export async function getExpenseReports() {
  const [byCategory, byUserRaw, byMonthRows] = await Promise.all([
    prisma.expenseTransaction.groupBy({ by: ["categoryNameSnapshot", "categoryTypeSnapshot"], _sum: { amount: true }, _count: true, orderBy: { _sum: { amount: "desc" } } }),
    prisma.expenseTransaction.groupBy({ by: ["createdById"], where: { categoryTypeSnapshot: "EXPENSE" }, _sum: { amount: true }, _count: true }),
    prisma.expenseTransaction.findMany({ select: { amount: true, categoryTypeSnapshot: true, createdAt: true } }),
  ]);
  const names = await userNameMap(byUserRaw.map((u) => u.createdById));
  const byUser = byUserRaw
    .map((u) => ({ user: names.get(u.createdById) ?? `#${u.createdById}`, total: u._sum.amount ?? 0, count: u._count }))
    .sort((a, b) => b.total - a.total);

  const monthMap = new Map<string, { expenses: number; transfers: number }>();
  for (const r of byMonthRows) {
    const key = `${r.createdAt.getFullYear()}-${String(r.createdAt.getMonth() + 1).padStart(2, "0")}`;
    const mm = monthMap.get(key) ?? { expenses: 0, transfers: 0 };
    if (r.categoryTypeSnapshot === "TRANSFER") mm.transfers += r.amount;
    else mm.expenses += r.amount;
    monthMap.set(key, mm);
  }
  const byMonth = [...monthMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([label, v]) => ({ label, ...v }));

  const cats = byCategory.map((c) => ({ name: c.categoryNameSnapshot, type: c.categoryTypeSnapshot, total: c._sum.amount ?? 0, count: c._count }));
  const expenseCats = cats.filter((c) => c.type !== "TRANSFER");
  const transferCats = cats.filter((c) => c.type === "TRANSFER");
  const sum = (xs: { total: number }[]) => xs.reduce((s, x) => s + x.total, 0);
  const cnt = (xs: { count: number }[]) => xs.reduce((s, x) => s + x.count, 0);
  const totalExpenses = sum(expenseCats);
  const totalTransfers = sum(transferCats);
  const expenseCount = cnt(expenseCats);
  const transferCount = cnt(transferCats);

  return {
    byCategory: cats,
    byUser,
    byMonth,
    typeSplit: { expenses: totalExpenses, transfers: totalTransfers },
    summary: {
      totalExpenses,
      totalTransfers,
      txCount: expenseCount + transferCount,
      expenseCount,
      avgExpense: expenseCount ? totalExpenses / expenseCount : 0,
      topCategory: expenseCats[0] ? { name: expenseCats[0].name, total: expenseCats[0].total } : null,
      topSpender: byUser[0] ? { user: byUser[0].user, total: byUser[0].total } : null,
    },
  };
}

// ---------------- Monthly reports + reconciliation ----------------

export async function createOrUpdateMonthlySalesReport(
  data: { year: number; month: number; totalSales: number; cashToStaff: number; cashToAramex: number; cashToSmsa: number; bankTransferAndMobileWallet: number; creditCard: number; note?: string | null },
  access: AuthedAccess,
) {
  const existing = await prisma.monthlySalesReport.findUnique({ where: { year_month: { year: data.year, month: data.month } } });
  const saved = await prisma.monthlySalesReport.upsert({
    where: { year_month: { year: data.year, month: data.month } },
    create: { ...data, note: data.note || null, createdById: access.user.id },
    update: { ...data, note: data.note || null, updatedById: access.user.id },
  });
  await writeAudit(access.user.id, "expenses", existing ? "expense.monthlySales.update" : "expense.monthlySales.create", "monthlySalesReport", `${data.year}-${data.month}`, { totalSales: data.totalSales });
  return saved;
}

export async function createOrUpdateMonthlyBankCollectionReport(
  data: { year: number; month: number; note?: string | null; lines: { accountId: number | null; accountNameSnapshot: string; amount: number }[] },
  access: AuthedAccess,
) {
  const existing = await prisma.monthlyBankCollectionReport.findUnique({ where: { year_month: { year: data.year, month: data.month } } });
  const report = await prisma.monthlyBankCollectionReport.upsert({
    where: { year_month: { year: data.year, month: data.month } },
    create: { year: data.year, month: data.month, note: data.note || null, createdById: access.user.id },
    update: { note: data.note || null, updatedById: access.user.id },
  });
  await prisma.monthlyBankCollectionLine.deleteMany({ where: { reportId: report.id } });
  for (const l of data.lines) {
    if (!Number.isFinite(l.amount)) continue;
    await prisma.monthlyBankCollectionLine.create({ data: { reportId: report.id, accountId: l.accountId, accountNameSnapshot: l.accountNameSnapshot, amount: l.amount } });
  }
  await writeAudit(access.user.id, "expenses", existing ? "expense.bankCollection.update" : "expense.bankCollection.create", "monthlyBankCollectionReport", `${data.year}-${data.month}`, { lines: data.lines.length });
  return report;
}

export async function calculateMonthlyReconciliation(year: number, month: number): Promise<ReconciliationResult> {
  const { gte, lt } = monthRange(year, month);
  const [sales, bank, exp, tr] = await Promise.all([
    prisma.monthlySalesReport.findUnique({ where: { year_month: { year, month } } }),
    prisma.monthlyBankCollectionLine.aggregate({ _sum: { amount: true }, where: { report: { year, month } } }),
    prisma.expenseTransaction.aggregate({ _sum: { amount: true }, where: { categoryTypeSnapshot: "EXPENSE", createdAt: { gte, lt } } }),
    prisma.expenseTransaction.aggregate({ _sum: { amount: true }, where: { categoryTypeSnapshot: "TRANSFER", createdAt: { gte, lt } } }),
  ]);
  return computeReconciliation({
    totalSales: sales?.totalSales ?? 0,
    bankCollectionsTotal: bank._sum.amount ?? 0,
    expensesTotal: exp._sum.amount ?? 0,
    transfersTotal: tr._sum.amount ?? 0,
  });
}

export { reconciliationStatus };

// ---------------- Settings "Save All" batches ----------------

const normType = (t: string) => (t === "TRANSFER" ? "TRANSFER" : "EXPENSE");

export interface CategoryRow {
  id: number;
  remove: boolean;
  name: string;
  nameAr: string | null;
  type: string;
  enabled: boolean;
}
export async function saveCategoryBatch(rows: CategoryRow[], add: { name: string; nameAr: string | null; type: string } | null) {
  const ops = [];
  for (const r of rows) {
    if (r.remove) {
      ops.push(prisma.expenseCategory.update({ where: { id: r.id }, data: { deletedAt: new Date() } }));
    } else if (r.name) {
      ops.push(
        prisma.expenseCategory.update({
          where: { id: r.id },
          data: { name: r.name, nameAr: r.nameAr || null, type: normType(r.type), enabled: r.enabled },
        }),
      );
    }
  }
  if (add?.name) ops.push(prisma.expenseCategory.create({ data: { name: add.name, nameAr: add.nameAr || null, type: normType(add.type) } }));
  if (ops.length) await prisma.$transaction(ops);
}

/** name → Arabic-name map for categories that have a translation (display use). */
export async function categoryArMap(): Promise<Record<string, string>> {
  const cats = await prisma.expenseCategory.findMany({ where: { nameAr: { not: null } }, select: { name: true, nameAr: true } });
  return Object.fromEntries(cats.map((c) => [c.name, c.nameAr as string]));
}

export interface AccountRow {
  id: number;
  remove: boolean;
  name: string;
  enabled: boolean;
}
export async function saveAccountBatch(rows: AccountRow[], add: { name: string } | null) {
  const ops = [];
  for (const r of rows) {
    if (r.remove) {
      ops.push(prisma.expenseAccount.update({ where: { id: r.id }, data: { deletedAt: new Date() } }));
    } else if (r.name) {
      ops.push(prisma.expenseAccount.update({ where: { id: r.id }, data: { name: r.name, enabled: r.enabled } }));
    }
  }
  if (add?.name) ops.push(prisma.expenseAccount.create({ data: { name: add.name } }));
  if (ops.length) await prisma.$transaction(ops);
}

/** Soft-delete a single category (kept in records via deletedAt). */
export async function deleteCategory(id: number) {
  await prisma.expenseCategory.update({ where: { id }, data: { deletedAt: new Date() } });
}

/** Soft-delete a single account. */
export async function deleteAccount(id: number) {
  await prisma.expenseAccount.update({ where: { id }, data: { deletedAt: new Date() } });
}
