-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ExpenseTransaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "amount" REAL NOT NULL,
    "categoryId" INTEGER,
    "categoryNameSnapshot" TEXT NOT NULL,
    "categoryTypeSnapshot" TEXT NOT NULL,
    "note" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" INTEGER,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExpenseTransaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ExpenseTransaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExpenseAttachment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "transactionId" INTEGER NOT NULL,
    "assetId" TEXT NOT NULL,
    "uploadedById" INTEGER,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExpenseAttachment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "ExpenseTransaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExpenseAccount" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MonthlySalesReport" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "totalSales" REAL NOT NULL,
    "cashToStaff" REAL NOT NULL DEFAULT 0,
    "cashToAramex" REAL NOT NULL DEFAULT 0,
    "cashToSmsa" REAL NOT NULL DEFAULT 0,
    "bankTransferAndMobileWallet" REAL NOT NULL DEFAULT 0,
    "creditCard" REAL NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" INTEGER,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MonthlyBankCollectionReport" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "note" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" INTEGER,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MonthlyBankCollectionLine" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "reportId" INTEGER NOT NULL,
    "accountId" INTEGER,
    "accountNameSnapshot" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    CONSTRAINT "MonthlyBankCollectionLine_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "MonthlyBankCollectionReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MonthlyBankCollectionLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ExpenseAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MonthlyReconciliationNote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "note" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" INTEGER,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "meta" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "ExpenseTransaction_categoryTypeSnapshot_idx" ON "ExpenseTransaction"("categoryTypeSnapshot");

-- CreateIndex
CREATE INDEX "ExpenseTransaction_createdAt_idx" ON "ExpenseTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "ExpenseTransaction_createdById_idx" ON "ExpenseTransaction"("createdById");

-- CreateIndex
CREATE INDEX "ExpenseAttachment_transactionId_idx" ON "ExpenseAttachment"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlySalesReport_year_month_key" ON "MonthlySalesReport"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyBankCollectionReport_year_month_key" ON "MonthlyBankCollectionReport"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyReconciliationNote_year_month_key" ON "MonthlyReconciliationNote"("year", "month");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_idx" ON "AuditLog"("entityType");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
