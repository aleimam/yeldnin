-- CreateTable
CREATE TABLE "Department" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "costCentre" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Employee" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uid" TEXT,
    "userId" INTEGER NOT NULL,
    "nationalIdNumber" TEXT,
    "nationalIdExpiry" DATETIME,
    "gradDegree" TEXT,
    "gradUniversity" TEXT,
    "gradFaculty" TEXT,
    "birthDate" DATETIME,
    "hiringDate" DATETIME,
    "annualAllowance" INTEGER,
    "urgentAllowance" INTEGER,
    "lineManagerId" INTEGER,
    "positionId" INTEGER,
    "departmentId" INTEGER,
    "bank" TEXT,
    "accountNo" TEXT,
    "salaryTypeId" INTEGER,
    "employeeTypeId" INTEGER,
    "notes" TEXT,
    "archivedAt" DATETIME,
    "createdById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" INTEGER,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Employee_lineManagerId_fkey" FOREIGN KEY ("lineManagerId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Employee_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Employee_salaryTypeId_fkey" FOREIGN KEY ("salaryTypeId") REFERENCES "SalaryType" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Employee_employeeTypeId_fkey" FOREIGN KEY ("employeeTypeId") REFERENCES "EmployeeType" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Employee" ("accountNo", "annualAllowance", "archivedAt", "bank", "birthDate", "createdAt", "createdById", "employeeTypeId", "gradDegree", "gradFaculty", "gradUniversity", "hiringDate", "id", "lineManagerId", "nationalIdExpiry", "nationalIdNumber", "notes", "positionId", "salaryTypeId", "uid", "updatedAt", "updatedById", "urgentAllowance", "userId") SELECT "accountNo", "annualAllowance", "archivedAt", "bank", "birthDate", "createdAt", "createdById", "employeeTypeId", "gradDegree", "gradFaculty", "gradUniversity", "hiringDate", "id", "lineManagerId", "nationalIdExpiry", "nationalIdNumber", "notes", "positionId", "salaryTypeId", "uid", "updatedAt", "updatedById", "urgentAllowance", "userId" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE UNIQUE INDEX "Employee_uid_key" ON "Employee"("uid");
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");
CREATE INDEX "Employee_lineManagerId_idx" ON "Employee"("lineManagerId");
CREATE INDEX "Employee_positionId_idx" ON "Employee"("positionId");
CREATE INDEX "Employee_salaryTypeId_idx" ON "Employee"("salaryTypeId");
CREATE INDEX "Employee_employeeTypeId_idx" ON "Employee"("employeeTypeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Department_key_key" ON "Department"("key");
