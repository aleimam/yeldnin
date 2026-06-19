-- AlterTable
ALTER TABLE "Employee" ADD COLUMN "annualAllowance" INTEGER;
ALTER TABLE "Employee" ADD COLUMN "urgentAllowance" INTEGER;

-- CreateTable
CREATE TABLE "HrConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "annualDefault" INTEGER NOT NULL DEFAULT 21,
    "urgentDefault" INTEGER NOT NULL DEFAULT 7,
    "weeklyOffDays" TEXT NOT NULL DEFAULT '5',
    "updatedById" INTEGER,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uid" TEXT,
    "employeeId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "days" INTEGER NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decidedById" INTEGER,
    "decidedAt" DATETIME,
    "decidedNote" TEXT,
    "createdById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Absence" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "note" TEXT,
    "coveredByUrgent" BOOLEAN NOT NULL DEFAULT false,
    "markedById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uid" TEXT,
    "title" TEXT NOT NULL,
    "titleAr" TEXT,
    "type" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "notes" TEXT,
    "archivedAt" DATETIME,
    "createdById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "HolidayBonus" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "holidayId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "amountPerDay" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HolidayBonus_holidayId_fkey" FOREIGN KEY ("holidayId") REFERENCES "Holiday" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "LeaveRequest_uid_key" ON "LeaveRequest"("uid");

-- CreateIndex
CREATE INDEX "LeaveRequest_employeeId_idx" ON "LeaveRequest"("employeeId");

-- CreateIndex
CREATE INDEX "LeaveRequest_status_idx" ON "LeaveRequest"("status");

-- CreateIndex
CREATE INDEX "Absence_employeeId_idx" ON "Absence"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Absence_employeeId_date_key" ON "Absence"("employeeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_uid_key" ON "Holiday"("uid");

-- CreateIndex
CREATE INDEX "Holiday_startDate_idx" ON "Holiday"("startDate");

-- CreateIndex
CREATE INDEX "HolidayBonus_holidayId_idx" ON "HolidayBonus"("holidayId");

-- CreateIndex
CREATE UNIQUE INDEX "HolidayBonus_holidayId_teamId_key" ON "HolidayBonus"("holidayId", "teamId");
