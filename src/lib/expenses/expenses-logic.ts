// Pure, dependency-free Expenses business logic. Unit-tested.
// No DB, no "server-only" — safe to import anywhere.

export const EDIT_WINDOW_DAYS = 7;

// Traffic-light thresholds for reconciliation difference (absolute value, EGP).
export const RECON_THRESHOLDS = { GREEN_MAX: 5000, YELLOW_MAX: 25000 };

export type ExpenseCategoryType = "EXPENSE" | "TRANSFER" | "REVENUE";
export type ReconStatus = "GREEN" | "YELLOW" | "RED";

/** The category types, in display order (Expense, Money Transfer, Revenue). */
export const CATEGORY_TYPES: ExpenseCategoryType[] = ["EXPENSE", "TRANSFER", "REVENUE"];

export function isExpenseType(t: string): boolean {
  return t === "EXPENSE";
}
export function isTransferType(t: string): boolean {
  return t === "TRANSFER";
}
export function isRevenueType(t: string): boolean {
  return t === "REVENUE";
}

/** Normalize an arbitrary string to a known category type (defaults to EXPENSE). */
export function normalizeCategoryType(t: string): ExpenseCategoryType {
  return (CATEGORY_TYPES as string[]).includes(t) ? (t as ExpenseCategoryType) : "EXPENSE";
}

/** i18n key for a category type's human label. */
export function typeLabelKey(type: string): string {
  if (type === "TRANSFER") return "exp.transfer";
  if (type === "REVENUE") return "exp.revenue";
  return "exp.expense";
}

/** Net expenses = gross expenses minus revenue (revenue offsets spend). */
export function netExpenses(expensesTotal: number, revenueTotal: number): number {
  return expensesTotal - revenueTotal;
}

/**
 * Can a user edit a transaction? (server-enforced; UI must not be trusted)
 * - managers → always
 * - otherwise: must own it, hold the edit permission, and be within the edit window
 */
export function canEditExpense(opts: {
  isManager: boolean;
  isOwner: boolean;
  hasEditPermission: boolean;
  createdAt: Date | string;
  now: Date;
  windowDays?: number;
}): boolean {
  if (opts.isManager) return true;
  if (!opts.hasEditPermission || !opts.isOwner) return false;
  const created = new Date(opts.createdAt).getTime();
  const days = (opts.now.getTime() - created) / 86_400_000;
  return days >= 0 && days <= (opts.windowDays ?? EDIT_WINDOW_DAYS);
}

/** Delete is manager-only (or anyone explicitly granted delete). */
export function canDeleteExpense(opts: {
  isManager: boolean;
  hasDeletePermission: boolean;
}): boolean {
  return opts.isManager || opts.hasDeletePermission;
}

/** Sum amounts of items whose category type matches. */
export function sumByType<T extends { amount: number; categoryTypeSnapshot: string }>(
  items: T[],
  type: ExpenseCategoryType,
): number {
  return items
    .filter((i) => i.categoryTypeSnapshot === type)
    .reduce((s, i) => s + i.amount, 0);
}

export interface SalesBreakdown {
  totalSales: number;
  cashToStaff: number;
  cashToAramex: number;
  cashToSmsa: number;
  bankTransferAndMobileWallet: number;
  creditCard: number;
}

/** Does the website payment breakdown add up to the declared total? */
export function checkSalesBreakdown(r: SalesBreakdown): {
  sum: number;
  difference: number;
  matches: boolean;
} {
  const sum =
    r.cashToStaff +
    r.cashToAramex +
    r.cashToSmsa +
    r.bankTransferAndMobileWallet +
    r.creditCard;
  const difference = r.totalSales - sum;
  return { sum, difference, matches: Math.abs(difference) < 0.5 };
}

export interface ReconciliationInput {
  totalSales: number;
  bankCollectionsTotal: number;
  expensesTotal: number;
  transfersTotal: number;
}

export interface ReconciliationResult {
  expected: number;
  actual: number;
  difference: number;
  status: ReconStatus;
}

/**
 * Expected = website total sales.
 * Actual money accounted for = bank/account collections + operations expenses + money deliveries.
 */
export function computeReconciliation(i: ReconciliationInput): ReconciliationResult {
  const expected = i.totalSales;
  const actual = i.bankCollectionsTotal + i.expensesTotal + i.transfersTotal;
  const difference = expected - actual;
  return { expected, actual, difference, status: reconciliationStatus(difference) };
}

export function reconciliationStatus(difference: number): ReconStatus {
  const d = Math.abs(difference);
  if (d <= RECON_THRESHOLDS.GREEN_MAX) return "GREEN";
  if (d <= RECON_THRESHOLDS.YELLOW_MAX) return "YELLOW";
  return "RED";
}
