-- AlterTable
ALTER TABLE "CsEvaluation" ADD COLUMN "archivedAt" DATETIME;
ALTER TABLE "CsEvaluation" ADD COLUMN "callDate" DATETIME;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CsEvaluationAnswer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "evaluationId" INTEGER NOT NULL,
    "questionId" INTEGER NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "criteria" TEXT NOT NULL,
    "typeName" TEXT,
    "weight" INTEGER NOT NULL,
    "level" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "weighted" REAL NOT NULL,
    "note" TEXT,
    CONSTRAINT "CsEvaluationAnswer_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "CsEvaluation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CsEvaluationAnswer" ("criteria", "evaluationId", "id", "level", "note", "questionId", "typeName", "value", "weight", "weighted") SELECT "criteria", "evaluationId", "id", "level", "note", "questionId", "typeName", "value", "weight", "weighted" FROM "CsEvaluationAnswer";
DROP TABLE "CsEvaluationAnswer";
ALTER TABLE "new_CsEvaluationAnswer" RENAME TO "CsEvaluationAnswer";
CREATE TABLE "new_CsQuestion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL DEFAULT '',
    "criteria" TEXT NOT NULL,
    "tags" TEXT,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "scope" TEXT NOT NULL,
    "typeId" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" DATETIME,
    "createdById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" INTEGER,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CsQuestion_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "CsEvalType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_CsQuestion" ("active", "archivedAt", "createdAt", "createdById", "criteria", "id", "scope", "sortOrder", "typeId", "updatedAt", "updatedById", "weight") SELECT "active", "archivedAt", "createdAt", "createdById", "criteria", "id", "scope", "sortOrder", "typeId", "updatedAt", "updatedById", "weight" FROM "CsQuestion";
DROP TABLE "CsQuestion";
ALTER TABLE "new_CsQuestion" RENAME TO "CsQuestion";
CREATE INDEX "CsQuestion_scope_idx" ON "CsQuestion"("scope");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Rename the scope value PERIODICAL → PERFORMANCE (prod has no CS rows yet; this
-- updates the dev-seeded types so existing rows match the renamed scope).
UPDATE "CsEvalType" SET "scope" = 'PERFORMANCE' WHERE "scope" = 'PERIODICAL';
UPDATE "CsQuestion" SET "scope" = 'PERFORMANCE' WHERE "scope" = 'PERIODICAL';
UPDATE "CsEvaluation" SET "scope" = 'PERFORMANCE' WHERE "scope" = 'PERIODICAL';
