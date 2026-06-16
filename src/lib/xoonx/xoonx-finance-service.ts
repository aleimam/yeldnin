import "server-only";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { monthKey, monthRange, toEgp, validateStaffShares, PETTY_CASH_START, round2 } from "./xoonx-finance-logic";

const XOONX = "xoonx"; // audit module key + the Request scope value (uppercased below)
const XOONX_SCOPE = "XOONX";

// ── FX rates (admin-set, per month) ─────────────────────────────────────────
export async function getFxRates(month: string): Promise<Map<string, number>> {
  const rows = await prisma.xoonxFxRate.findMany({ where: { month } });
  return new Map(rows.map((r) => [r.currency, r.rate]));
}
export async function setFxRate(month: string, currency: string, rate: number, userId: number) {
  // A non-positive rate would silently zero out every foreign cost (and still let
  // the month close), inflating net profit + the staff payout. Reject it.
  if (!(rate > 0)) throw new Error("FX rate must be greater than 0.");
  await prisma.xoonxFxRate.upsert({
    where: { month_currency: { month, currency } },
    update: { rate, updatedById: userId },
    create: { month, currency, rate, updatedById: userId },
  });
  await writeAudit(userId, XOONX, "fx.set", "xoonxFx", 0, { month, currency, rate });
}
export { toEgp };

// ── Expense categories (admin) ──────────────────────────────────────────────
export async function listExpenseCategories(includeDisabled = false) {
  return prisma.xoonxExpenseCategory.findMany({
    where: { deletedAt: null, ...(includeDisabled ? {} : { enabled: true }) },
    orderBy: { sortOrder: "asc" },
  });
}
export async function createExpenseCategory(name: string, userId: number) {
  const max = await prisma.xoonxExpenseCategory.aggregate({ _max: { sortOrder: true } });
  const cat = await prisma.xoonxExpenseCategory.create({ data: { name: name.trim(), sortOrder: (max._max.sortOrder ?? 0) + 1 } });
  await writeAudit(userId, XOONX, "cat.create", "xoonxCat", cat.id, { name });
  return cat;
}
export async function renameExpenseCategory(id: number, name: string, userId: number) {
  await prisma.xoonxExpenseCategory.update({ where: { id }, data: { name: name.trim() } });
  await writeAudit(userId, XOONX, "cat.rename", "xoonxCat", id, { name });
}
export async function setCategoryEnabled(id: number, enabled: boolean, userId: number) {
  await prisma.xoonxExpenseCategory.update({ where: { id }, data: { enabled } });
  await writeAudit(userId, XOONX, "cat.enable", "xoonxCat", id, { enabled });
}
export async function deleteExpenseCategory(id: number, userId: number) {
  const used = await prisma.xoonxExpense.count({ where: { categoryId: id } });
  if (used > 0) throw new Error("This category has expenses recorded — rename or disable it instead.");
  await prisma.xoonxExpenseCategory.update({ where: { id }, data: { deletedAt: new Date(), enabled: false } });
  await writeAudit(userId, XOONX, "cat.delete", "xoonxCat", id, {});
}

// ── Expenses ────────────────────────────────────────────────────────────────
export interface ExpenseInput {
  categoryId: number | null;
  amount: number;
  note?: string | null;
  requestId?: number | null;
}

// An expense may optionally be allocated to a XOONX request (never another scope).
async function assertXoonxRequest(requestId: number | null | undefined): Promise<number | null> {
  if (!requestId) return null;
  const r = await prisma.request.findFirst({ where: { id: requestId, archivedAt: null }, select: { scope: true } });
  if (!r || r.scope !== XOONX_SCOPE) throw new Error("Pick a XOONX request.");
  return requestId;
}

/** Recent XOONX requests for the expense-allocation dropdown. */
export async function listXoonxRequestOptions() {
  const rows = await prisma.request.findMany({
    where: { scope: XOONX_SCOPE, archivedAt: null },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, uid: true, lines: { take: 1, select: { product: { select: { name: true } } } } },
  });
  return rows.map((r) => ({ id: r.id, uid: r.uid, product: r.lines[0]?.product.name ?? "—" }));
}

export async function createExpense(input: ExpenseInput, userId: number) {
  if (!(input.amount > 0)) throw new Error("Amount must be greater than zero.");
  const cat = input.categoryId ? await prisma.xoonxExpenseCategory.findUnique({ where: { id: input.categoryId } }) : null;
  const requestId = await assertXoonxRequest(input.requestId);
  const e = await prisma.xoonxExpense.create({
    data: {
      date: new Date(), // automatic timestamp — users don't pick the date
      categoryId: cat?.id ?? null,
      categoryNameSnapshot: cat?.name ?? "—",
      amount: input.amount,
      note: input.note?.trim() || null,
      requestId,
      createdById: userId,
    },
  });
  await writeAudit(userId, XOONX, "expense.create", "xoonxExpense", e.id, { amount: input.amount });
  return e;
}
export async function updateExpense(id: number, input: ExpenseInput, userId: number) {
  const e = await prisma.xoonxExpense.findUnique({ where: { id } });
  if (!e) throw new Error("Expense not found.");
  if (await isMonthClosed(monthKey(e.date))) throw new Error("This expense is in a closed month and can no longer be edited.");
  if (!(input.amount > 0)) throw new Error("Amount must be greater than zero.");
  const cat = input.categoryId ? await prisma.xoonxExpenseCategory.findUnique({ where: { id: input.categoryId } }) : null;
  const requestId = await assertXoonxRequest(input.requestId);
  // The original timestamp is kept — edits change what/how-much, not when.
  await prisma.xoonxExpense.update({
    where: { id },
    data: { categoryId: cat?.id ?? null, categoryNameSnapshot: cat?.name ?? "—", amount: input.amount, note: input.note?.trim() || null, requestId, updatedById: userId },
  });
  await writeAudit(userId, XOONX, "expense.update", "xoonxExpense", id, {});
}
export async function deleteExpense(id: number, userId: number) {
  const e = await prisma.xoonxExpense.findUnique({ where: { id } });
  if (!e) return;
  if (await isMonthClosed(monthKey(e.date))) throw new Error("This expense is in a closed month and can no longer be deleted.");
  await prisma.xoonxExpense.delete({ where: { id } });
  await writeAudit(userId, XOONX, "expense.delete", "xoonxExpense", id, {});
}
export async function listExpenses(month: string) {
  const { gte, lt } = monthRange(month);
  return prisma.xoonxExpense.findMany({ where: { date: { gte, lt } }, orderBy: { date: "desc" } });
}

// ── Treasury ────────────────────────────────────────────────────────────────
// Petty cash = start − expenses that sit in NOT-yet-closed months (closed months
// are auto-refilled at close).
export async function pettyCashBalance(): Promise<number> {
  const closed = new Set((await prisma.xoonxMonthClose.findMany({ select: { month: true } })).map((c) => c.month));
  const expenses = await prisma.xoonxExpense.findMany({ select: { amount: true, date: true } });
  const open = expenses.filter((e) => !closed.has(monthKey(e.date))).reduce((s, e) => s + e.amount, 0);
  return round2(PETTY_CASH_START - open);
}

// ── Month close (read side; closeMonth lands with Reports) ──────────────────
export async function isMonthClosed(month: string): Promise<boolean> {
  return (await prisma.xoonxMonthClose.count({ where: { month } })) > 0;
}

// ── Staff & profit split ────────────────────────────────────────────────────
// XOONX staff = MEMBER-tier users who hold a xoonx module permission (admins who
// hold xoonx for access are not profit-sharing staff).
export async function listXoonxStaff(): Promise<{ id: number; name: string }[]> {
  const rows = await prisma.user.findMany({
    where: { active: true, archivedAt: null, tier: "MEMBER", modulePerms: { some: { moduleKey: XOONX, level: { not: "NONE" } } } },
    select: { id: true, name: true, fullName: true },
    orderBy: { name: "asc" },
  });
  return rows.map((u) => ({ id: u.id, name: u.fullName || u.name }));
}
/** Each staff member's share % of the 25% pool (defaults to an equal split). */
export async function getStaffShares(): Promise<{ id: number; name: string; sharePct: number }[]> {
  const staff = await listXoonxStaff();
  const shares = new Map((await prisma.xoonxStaffShare.findMany()).map((s) => [s.userId, s.sharePct]));
  const anySet = staff.some((s) => shares.has(s.id));
  if (!anySet && staff.length) {
    const eq = round2(100 / staff.length);
    return staff.map((s) => ({ ...s, sharePct: eq }));
  }
  return staff.map((s) => ({ ...s, sharePct: shares.get(s.id) ?? 0 }));
}
export async function setStaffShares(shares: { userId: number; sharePct: number }[], userId: number) {
  const err = validateStaffShares(shares);
  if (err) throw new Error(err);
  for (const s of shares) {
    await prisma.xoonxStaffShare.upsert({ where: { userId: s.userId }, update: { sharePct: s.sharePct }, create: { userId: s.userId, sharePct: s.sharePct } });
  }
  await writeAudit(userId, XOONX, "split.set", "xoonxSplit", 0, { count: shares.length });
}
