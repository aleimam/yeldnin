-- CreateTable
CREATE TABLE "SalaryStructureLine" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" INTEGER NOT NULL,
    "componentId" INTEGER NOT NULL,
    "amount" REAL NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" INTEGER,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SalaryStructureLine_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SalaryStructureLine_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "SalaryComponent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SalaryChange" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lineId" INTEGER NOT NULL,
    "changeType" TEXT NOT NULL,
    "delta" REAL NOT NULL,
    "oldAmount" REAL NOT NULL,
    "newAmount" REAL NOT NULL,
    "effectiveDate" DATETIME NOT NULL,
    "reason" TEXT,
    "batchId" TEXT,
    "byUserId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalaryChange_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "SalaryStructureLine" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SalaryComponent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "kind" TEXT NOT NULL,
    "valuation" TEXT NOT NULL DEFAULT 'FIXED_EVENT',
    "defaultAmount" REAL,
    "notes" TEXT,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" DATETIME,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_SalaryComponent" ("archivedAt", "code", "createdAt", "createdById", "id", "kind", "name", "nameAr", "notes", "sortOrder", "system", "updatedAt") SELECT "archivedAt", "code", "createdAt", "createdById", "id", "kind", "name", "nameAr", "notes", "sortOrder", "system", "updatedAt" FROM "SalaryComponent";
DROP TABLE "SalaryComponent";
ALTER TABLE "new_SalaryComponent" RENAME TO "SalaryComponent";
CREATE UNIQUE INDEX "SalaryComponent_code_key" ON "SalaryComponent"("code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "SalaryStructureLine_employeeId_idx" ON "SalaryStructureLine"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryStructureLine_employeeId_componentId_key" ON "SalaryStructureLine"("employeeId", "componentId");

-- CreateIndex
CREATE INDEX "SalaryChange_lineId_idx" ON "SalaryChange"("lineId");

-- CreateIndex
CREATE INDEX "SalaryChange_effectiveDate_idx" ON "SalaryChange"("effectiveDate");
