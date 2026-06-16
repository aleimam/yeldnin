-- CreateTable
CREATE TABLE "XoonxExpenseCategory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" DATETIME
);

-- CreateTable
CREATE TABLE "XoonxExpense" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "categoryId" INTEGER,
    "categoryNameSnapshot" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "note" TEXT,
    "requestId" INTEGER,
    "tripId" INTEGER,
    "createdById" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" INTEGER,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "XoonxExpense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "XoonxExpenseCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "XoonxFxRate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "month" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "rate" REAL NOT NULL,
    "updatedById" INTEGER,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "XoonxMonthClose" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "month" TEXT NOT NULL,
    "closedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedById" INTEGER NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "pettyRefill" REAL NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "XoonxStaffShare" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "sharePct" REAL NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE INDEX "XoonxExpense_date_idx" ON "XoonxExpense"("date");

-- CreateIndex
CREATE INDEX "XoonxExpense_categoryId_idx" ON "XoonxExpense"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "XoonxFxRate_month_currency_key" ON "XoonxFxRate"("month", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "XoonxMonthClose_month_key" ON "XoonxMonthClose"("month");

-- CreateIndex
CREATE UNIQUE INDEX "XoonxStaffShare_userId_key" ON "XoonxStaffShare"("userId");
