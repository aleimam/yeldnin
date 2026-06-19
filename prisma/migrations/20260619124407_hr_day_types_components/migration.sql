-- CreateTable
CREATE TABLE "SalaryComponent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "kind" TEXT NOT NULL,
    "notes" TEXT,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" DATETIME,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DayType" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "dayClass" TEXT NOT NULL,
    "bonusComponentId" INTEGER,
    "penaltyComponentId" INTEGER,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" DATETIME,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DutyDay" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "dayTypeId" INTEGER NOT NULL,
    "note" TEXT,
    "markedById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_HrConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "annualDefault" INTEGER NOT NULL DEFAULT 21,
    "urgentDefault" INTEGER NOT NULL DEFAULT 7,
    "weeklyOffDays" TEXT NOT NULL DEFAULT '5',
    "dutyEidDays" TEXT NOT NULL DEFAULT 'ED',
    "dutyEidVacation" TEXT NOT NULL DEFAULT 'D',
    "dutyVacation" TEXT NOT NULL DEFAULT 'VD',
    "dutyWeekend" TEXT NOT NULL DEFAULT 'D',
    "updatedById" INTEGER,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_HrConfig" ("annualDefault", "id", "updatedAt", "updatedById", "urgentDefault", "weeklyOffDays") SELECT "annualDefault", "id", "updatedAt", "updatedById", "urgentDefault", "weeklyOffDays" FROM "HrConfig";
DROP TABLE "HrConfig";
ALTER TABLE "new_HrConfig" RENAME TO "HrConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "SalaryComponent_code_key" ON "SalaryComponent"("code");

-- CreateIndex
CREATE UNIQUE INDEX "DayType_code_key" ON "DayType"("code");

-- CreateIndex
CREATE INDEX "DutyDay_employeeId_idx" ON "DutyDay"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "DutyDay_employeeId_date_key" ON "DutyDay"("employeeId", "date");
