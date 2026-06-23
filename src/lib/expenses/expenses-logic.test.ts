import { describe, it, expect } from "vitest";
import {
  canEditExpense,
  canDeleteExpense,
  computeReconciliation,
  reconciliationStatus,
  checkSalesBreakdown,
  sumByType,
  netExpenses,
  typeLabelKey,
  normalizeCategoryType,
} from "./expenses-logic";

describe("canEditExpense", () => {
  const now = new Date("2026-06-15T00:00:00Z");
  it("managers can always edit", () => {
    expect(canEditExpense({ isManager: true, isOwner: false, hasEditPermission: false, createdAt: "2020-01-01", now })).toBe(true);
  });
  it("owner with permission within window can edit", () => {
    expect(canEditExpense({ isManager: false, isOwner: true, hasEditPermission: true, createdAt: "2026-06-10", now })).toBe(true);
  });
  it("owner past the window cannot edit", () => {
    expect(canEditExpense({ isManager: false, isOwner: true, hasEditPermission: true, createdAt: "2026-05-01", now })).toBe(false);
  });
  it("non-owner without manager cannot edit", () => {
    expect(canEditExpense({ isManager: false, isOwner: false, hasEditPermission: true, createdAt: "2026-06-14", now })).toBe(false);
  });
});

describe("canDeleteExpense", () => {
  it("managers or delete-permission can delete", () => {
    expect(canDeleteExpense({ isManager: true, hasDeletePermission: false })).toBe(true);
    expect(canDeleteExpense({ isManager: false, hasDeletePermission: true })).toBe(true);
    expect(canDeleteExpense({ isManager: false, hasDeletePermission: false })).toBe(false);
  });
});

describe("reconciliation", () => {
  it("traffic-light status by absolute difference", () => {
    expect(reconciliationStatus(0)).toBe("GREEN");
    expect(reconciliationStatus(5000)).toBe("GREEN");
    expect(reconciliationStatus(-9000)).toBe("YELLOW");
    expect(reconciliationStatus(30000)).toBe("RED");
  });
  it("expected - actual", () => {
    const r = computeReconciliation({ totalSales: 100000, bankCollectionsTotal: 60000, expensesTotal: 20000, transfersTotal: 15000 });
    expect(r.expected).toBe(100000);
    expect(r.actual).toBe(95000);
    expect(r.difference).toBe(5000);
    expect(r.status).toBe("GREEN");
  });
});

describe("checkSalesBreakdown / sumByType", () => {
  it("breakdown matches when components add to total", () => {
    const r = checkSalesBreakdown({ totalSales: 100, cashToStaff: 40, cashToAramex: 10, cashToSmsa: 10, bankTransferAndMobileWallet: 20, creditCard: 20 });
    expect(r.matches).toBe(true);
    expect(r.difference).toBeCloseTo(0);
  });
  it("sumByType filters by category type (incl. revenue)", () => {
    const items = [
      { amount: 100, categoryTypeSnapshot: "EXPENSE" },
      { amount: 50, categoryTypeSnapshot: "TRANSFER" },
      { amount: 25, categoryTypeSnapshot: "EXPENSE" },
      { amount: 30, categoryTypeSnapshot: "REVENUE" },
    ];
    expect(sumByType(items, "EXPENSE")).toBe(125);
    expect(sumByType(items, "TRANSFER")).toBe(50);
    expect(sumByType(items, "REVENUE")).toBe(30);
  });
});

describe("revenue helpers", () => {
  it("netExpenses subtracts revenue from gross expenses", () => {
    expect(netExpenses(10000, 3000)).toBe(7000);
    expect(netExpenses(5000, 0)).toBe(5000);
    expect(netExpenses(1000, 1500)).toBe(-500); // revenue can exceed spend
  });
  it("typeLabelKey maps each type to its i18n key", () => {
    expect(typeLabelKey("EXPENSE")).toBe("exp.expense");
    expect(typeLabelKey("TRANSFER")).toBe("exp.transfer");
    expect(typeLabelKey("REVENUE")).toBe("exp.revenue");
    expect(typeLabelKey("whatever")).toBe("exp.expense"); // unknown → expense
  });
  it("normalizeCategoryType keeps known types and defaults the rest to EXPENSE", () => {
    expect(normalizeCategoryType("REVENUE")).toBe("REVENUE");
    expect(normalizeCategoryType("TRANSFER")).toBe("TRANSFER");
    expect(normalizeCategoryType("EXPENSE")).toBe("EXPENSE");
    expect(normalizeCategoryType("garbage")).toBe("EXPENSE");
  });
});
