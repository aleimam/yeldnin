import "server-only";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { getLocale } from "@/i18n/server";
import { monthKey, monthRange, monthCloseable, toEgp, validateStaffShares, PETTY_CASH_START, STAFF_POOL_PCT, YELDN_PCT, round2 } from "./xoonx-finance-logic";

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
  const [locale, rows] = await Promise.all([
    getLocale(),
    prisma.user.findMany({
      where: { active: true, archivedAt: null, tier: "MEMBER", modulePerms: { some: { moduleKey: XOONX, level: { not: "NONE" } } } },
      select: { id: true, name: true, nameAr: true, fullName: true, fullNameAr: true },
      orderBy: { name: "asc" },
    }),
  ]);
  // Profit-split roster prefers the official full name; in Arabic, the Arabic
  // official/display name when present.
  return rows.map((u) => ({
    id: u.id,
    name: locale === "ar"
      ? u.fullNameAr || u.nameAr || u.fullName || u.name
      : u.fullName || u.name,
  }));
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

// ── Delivery (revenue recognition) ──────────────────────────────────────────
// A XOONX order's revenue is recognised when it's marked delivered (the month of
// `deliveredAt`). Revenue = the order's items' selling prices (already EGP).
export async function markRequestDelivered(requestId: number, userId: number) {
  const r = await prisma.request.findFirst({ where: { id: requestId, scope: XOONX_SCOPE, archivedAt: null }, select: { id: true, deliveredAt: true } });
  if (!r) throw new Error("XOONX order not found.");
  if (r.deliveredAt) throw new Error("This order is already marked delivered.");
  await prisma.request.update({ where: { id: requestId }, data: { deliveredAt: new Date() } });
  await writeAudit(userId, XOONX, "order.delivered", "request", requestId, {});
}
export async function unmarkRequestDelivered(requestId: number, userId: number) {
  const r = await prisma.request.findUnique({ where: { id: requestId }, select: { deliveredAt: true } });
  if (!r?.deliveredAt) return;
  if (await isMonthClosed(monthKey(r.deliveredAt))) throw new Error("That delivery month is already closed.");
  await prisma.request.update({ where: { id: requestId }, data: { deliveredAt: null } });
  await writeAudit(userId, XOONX, "order.undeliver", "request", requestId, {});
}

// ── Reports (P&L) ───────────────────────────────────────────────────────────
export interface OrderLine { requestId: number; uid: string; product: string; selling: number; purchasing: number; gross: number }
export interface PerStaff { id: number; name: string; sharePct: number; amount: number }
export interface MonthlyReport {
  month: string;
  closed: boolean;
  closeable: boolean;
  missingFx: boolean;
  revenue: number;
  costs: { purchasing: number; local: number; total: number };
  grossProfit: number;
  netProfit: number;
  distribution: { staffPool: number; yeldn: number; perStaff: PerStaff[] };
  orders: OrderLine[];
  localByCategory: { name: string; amount: number }[];
}

export async function monthlyReport(month: string, now: Date): Promise<MonthlyReport> {
  const { gte, lt } = monthRange(month);
  const rates = await getFxRates(month);
  let missingFx = false;

  // Revenue books from XOONX orders delivered this month (sum of their items' selling prices, EGP).
  const requests = await prisma.request.findMany({
    where: { scope: XOONX_SCOPE, archivedAt: null, deliveredAt: { gte, lt } },
    select: { id: true, uid: true },
  });
  const uidOf = new Map(requests.map((r) => [r.id, r.uid ?? `#${r.id}`]));
  const items = requests.length
    ? await prisma.item.findMany({
        where: { requestId: { in: requests.map((r) => r.id) } },
        select: { requestId: true, sellingPrice: true, purchasePrice: true, purchaseCurrency: true, product: { select: { name: true } } },
      })
    : [];

  const byReq = new Map<number, OrderLine>();
  let purchasing = 0;
  for (const it of items) {
    const p = toEgp(it.purchasePrice, it.purchaseCurrency, rates);
    missingFx = missingFx || p.missing;
    purchasing += p.egp;
    const rid = it.requestId as number;
    const line = byReq.get(rid) ?? { requestId: rid, uid: uidOf.get(rid) ?? `#${rid}`, product: it.product.name, selling: 0, purchasing: 0, gross: 0 };
    line.selling += it.sellingPrice ?? 0;
    line.purchasing += p.egp;
    byReq.set(rid, line);
  }
  const orders = [...byReq.values()].map((l) => ({ ...l, selling: round2(l.selling), purchasing: round2(l.purchasing), gross: round2(l.selling - l.purchasing) }));

  // Local costs = XOONX expenses this month (shipping/handling live here as categories).
  const expenses = await prisma.xoonxExpense.findMany({ where: { date: { gte, lt } }, select: { amount: true, categoryNameSnapshot: true } });
  const local = expenses.reduce((s, e) => s + e.amount, 0);
  const catMap = new Map<string, number>();
  for (const e of expenses) catMap.set(e.categoryNameSnapshot, (catMap.get(e.categoryNameSnapshot) ?? 0) + e.amount);
  const localByCategory = [...catMap.entries()].map(([name, amount]) => ({ name, amount: round2(amount) })).sort((a, b) => b.amount - a.amount);

  const revenue = orders.reduce((s, o) => s + o.selling, 0);
  const grossProfit = orders.reduce((s, o) => s + o.gross, 0);
  const total = purchasing + local;
  const netProfit = revenue - total;

  const staffShares = await getStaffShares();
  const staffPool = netProfit * (STAFF_POOL_PCT / 100);
  const yeldn = netProfit * (YELDN_PCT / 100);
  const perStaff = staffShares.map((s) => ({ id: s.id, name: s.name, sharePct: s.sharePct, amount: round2(staffPool * (s.sharePct / 100)) }));

  return {
    // A month with an unpriced foreign cost is NOT closeable — its costs would be understated.
    month, closed: await isMonthClosed(month), closeable: monthCloseable(month, now) && !missingFx, missingFx,
    revenue: round2(revenue),
    costs: { purchasing: round2(purchasing), local: round2(local), total: round2(total) },
    grossProfit: round2(grossProfit), netProfit: round2(netProfit),
    distribution: { staffPool: round2(staffPool), yeldn: round2(yeldn), perStaff },
    orders, localByCategory,
  };
}

export interface YearlyReport {
  year: string;
  missingFx: boolean;
  revenue: number;
  costs: MonthlyReport["costs"];
  grossProfit: number;
  netProfit: number;
  byMonth: { month: string; revenue: number; netProfit: number }[];
  distribution: MonthlyReport["distribution"];
  localByCategory: { name: string; amount: number }[];
}
export async function yearlyReport(year: string, now: Date): Promise<YearlyReport> {
  // The 12 monthly reports are independent — run them concurrently instead of
  // 12 sequential round-trips.
  const reports: MonthlyReport[] = await Promise.all(
    Array.from({ length: 12 }, (_, i) => monthlyReport(`${year}-${String(i + 1).padStart(2, "0")}`, now)),
  );
  const sum = (f: (r: MonthlyReport) => number) => reports.reduce((s, r) => s + f(r), 0);
  const netProfit = round2(sum((r) => r.netProfit));
  const catMap = new Map<string, number>();
  for (const r of reports) for (const c of r.localByCategory) catMap.set(c.name, (catMap.get(c.name) ?? 0) + c.amount);
  const staffShares = await getStaffShares();
  const staffPool = netProfit * (STAFF_POOL_PCT / 100);
  const yeldn = netProfit * (YELDN_PCT / 100);
  return {
    year,
    missingFx: reports.some((r) => r.missingFx),
    revenue: round2(sum((r) => r.revenue)),
    costs: { purchasing: round2(sum((r) => r.costs.purchasing)), local: round2(sum((r) => r.costs.local)), total: round2(sum((r) => r.costs.total)) },
    grossProfit: round2(sum((r) => r.grossProfit)),
    netProfit,
    byMonth: reports.map((r) => ({ month: r.month, revenue: r.revenue, netProfit: r.netProfit })),
    distribution: { staffPool: round2(staffPool), yeldn: round2(yeldn), perStaff: staffShares.map((s) => ({ id: s.id, name: s.name, sharePct: s.sharePct, amount: round2(staffPool * (s.sharePct / 100)) })) },
    localByCategory: [...catMap.entries()].map(([name, amount]) => ({ name, amount: round2(amount) })).sort((a, b) => b.amount - a.amount),
  };
}

// ── Month close ─────────────────────────────────────────────────────────────
export async function closeMonth(month: string, userId: number, now: Date) {
  if (await isMonthClosed(month)) throw new Error("This month is already closed.");
  if (!monthCloseable(month, now)) throw new Error("A month can only be closed 7 days after it has ended.");
  const report = await monthlyReport(month, now);
  if (report.missingFx) throw new Error("Some purchase costs use a currency with no FX rate set for this month. Set the rates first.");
  await prisma.xoonxMonthClose.create({ data: { month, closedById: userId, snapshotJson: JSON.stringify(report), pettyRefill: report.costs.local } });
  await writeAudit(userId, XOONX, "month.close", "xoonxMonthClose", 0, { month, refill: report.costs.local });
}
