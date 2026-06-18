-- CreateTable
CREATE TABLE "CsRepBonus" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "maxBonus" REAL NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CsBonusTier" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fromPct" REAL NOT NULL,
    "bonusPct" REAL NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CsEvalType" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "scope" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "weight" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_CsEvalType" ("archivedAt", "createdAt", "id", "name", "scope", "sortOrder", "updatedAt") SELECT "archivedAt", "createdAt", "id", "name", "scope", "sortOrder", "updatedAt" FROM "CsEvalType";
DROP TABLE "CsEvalType";
ALTER TABLE "new_CsEvalType" RENAME TO "CsEvalType";
CREATE INDEX "CsEvalType_scope_idx" ON "CsEvalType"("scope");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "CsRepBonus_userId_key" ON "CsRepBonus"("userId");
