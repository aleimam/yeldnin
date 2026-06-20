-- CreateTable
CREATE TABLE "Payslip" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uid" TEXT,
    "employeeId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "basic" REAL NOT NULL DEFAULT 0,
    "earningsTotal" REAL NOT NULL DEFAULT 0,
    "bonusTotal" REAL NOT NULL DEFAULT 0,
    "penaltyTotal" REAL NOT NULL DEFAULT 0,
    "gross" REAL NOT NULL DEFAULT 0,
    "net" REAL NOT NULL DEFAULT 0,
    "workingDays" INTEGER NOT NULL DEFAULT 0,
    "dayOfBasic" REAL NOT NULL DEFAULT 0,
    "dayOfTotal" REAL NOT NULL DEFAULT 0,
    "absentOverLimit" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "generatedById" INTEGER,
    "lockedById" INTEGER,
    "lockedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Payslip_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PayslipLine" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "payslipId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "componentId" INTEGER,
    "label" TEXT NOT NULL,
    "valuation" TEXT,
    "qty" REAL,
    "rate" REAL,
    "amount" REAL NOT NULL DEFAULT 0,
    "detail" TEXT,
    "createdById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PayslipLine_payslipId_fkey" FOREIGN KEY ("payslipId") REFERENCES "Payslip" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Payslip_uid_key" ON "Payslip"("uid");

-- CreateIndex
CREATE INDEX "Payslip_employeeId_idx" ON "Payslip"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Payslip_employeeId_year_month_key" ON "Payslip"("employeeId", "year", "month");

-- CreateIndex
CREATE INDEX "PayslipLine_payslipId_idx" ON "PayslipLine"("payslipId");
