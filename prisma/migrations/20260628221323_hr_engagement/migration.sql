-- CreateTable
CREATE TABLE "EngagementCategory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" DATETIME,
    "createdById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" INTEGER,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EngagementTemplate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "categoryId" INTEGER,
    "description" TEXT,
    "archivedAt" DATETIME,
    "createdById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" INTEGER,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EngagementTemplate_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "EngagementCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EngagementCriterion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "templateId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "bonusAmount" REAL NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EngagementCriterion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EngagementTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EngagementEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uid" TEXT,
    "templateId" INTEGER NOT NULL,
    "title" TEXT,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "notes" TEXT,
    "archivedAt" DATETIME,
    "createdById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" INTEGER,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EngagementEvent_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EngagementTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EngagementEligible" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eventId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    CONSTRAINT "EngagementEligible_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "EngagementEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EngagementEligible_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EngagementAchievement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eventId" INTEGER NOT NULL,
    "criterionId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "achievedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "byUserId" INTEGER,
    CONSTRAINT "EngagementAchievement_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "EngagementEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EngagementAchievement_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "EngagementCriterion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EngagementAchievement_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "EngagementTemplate_categoryId_idx" ON "EngagementTemplate"("categoryId");

-- CreateIndex
CREATE INDEX "EngagementCriterion_templateId_idx" ON "EngagementCriterion"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "EngagementEvent_uid_key" ON "EngagementEvent"("uid");

-- CreateIndex
CREATE INDEX "EngagementEvent_templateId_idx" ON "EngagementEvent"("templateId");

-- CreateIndex
CREATE INDEX "EngagementEvent_year_month_idx" ON "EngagementEvent"("year", "month");

-- CreateIndex
CREATE INDEX "EngagementEligible_employeeId_idx" ON "EngagementEligible"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "EngagementEligible_eventId_employeeId_key" ON "EngagementEligible"("eventId", "employeeId");

-- CreateIndex
CREATE INDEX "EngagementAchievement_employeeId_idx" ON "EngagementAchievement"("employeeId");

-- CreateIndex
CREATE INDEX "EngagementAchievement_eventId_idx" ON "EngagementAchievement"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "EngagementAchievement_eventId_criterionId_employeeId_key" ON "EngagementAchievement"("eventId", "criterionId", "employeeId");
