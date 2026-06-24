-- CreateTable
CREATE TABLE "Department" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" DATETIME,
    "createdById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Position" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "departmentId" INTEGER,
    "title" TEXT NOT NULL,
    "titleAr" TEXT,
    "grade" TEXT,
    "description" TEXT,
    "descriptionAr" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" DATETIME,
    "createdById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Position_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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
    "notes" TEXT,
    "archivedAt" DATETIME,
    "createdById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" INTEGER,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Employee_lineManagerId_fkey" FOREIGN KEY ("lineManagerId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Employee_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Employee" ("annualAllowance", "archivedAt", "birthDate", "createdAt", "createdById", "gradDegree", "gradFaculty", "gradUniversity", "hiringDate", "id", "lineManagerId", "nationalIdExpiry", "nationalIdNumber", "notes", "uid", "updatedAt", "updatedById", "urgentAllowance", "userId") SELECT "annualAllowance", "archivedAt", "birthDate", "createdAt", "createdById", "gradDegree", "gradFaculty", "gradUniversity", "hiringDate", "id", "lineManagerId", "nationalIdExpiry", "nationalIdNumber", "notes", "uid", "updatedAt", "updatedById", "urgentAllowance", "userId" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE UNIQUE INDEX "Employee_uid_key" ON "Employee"("uid");
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");
CREATE INDEX "Employee_lineManagerId_idx" ON "Employee"("lineManagerId");
CREATE INDEX "Employee_positionId_idx" ON "Employee"("positionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Position_departmentId_idx" ON "Position"("departmentId");
