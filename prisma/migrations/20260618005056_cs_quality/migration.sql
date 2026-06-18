-- CreateTable
CREATE TABLE "CsEvalType" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "scope" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CsQuestion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "criteria" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "CsConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "config" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CsEvaluation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uid" TEXT,
    "subjectUserId" INTEGER NOT NULL,
    "evaluatorUserId" INTEGER NOT NULL,
    "scope" TEXT NOT NULL,
    "typeName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "total" REAL NOT NULL DEFAULT 0,
    "normalized" REAL NOT NULL DEFAULT 0,
    "approvedById" INTEGER,
    "approvedAt" DATETIME,
    "rejectedNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CsEvaluationAnswer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "evaluationId" INTEGER NOT NULL,
    "questionId" INTEGER NOT NULL,
    "criteria" TEXT NOT NULL,
    "typeName" TEXT,
    "weight" INTEGER NOT NULL,
    "level" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "weighted" REAL NOT NULL,
    "note" TEXT,
    CONSTRAINT "CsEvaluationAnswer_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "CsEvaluation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CsEvaluationPhoto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "evaluationId" INTEGER NOT NULL,
    "assetId" TEXT NOT NULL,
    CONSTRAINT "CsEvaluationPhoto_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "CsEvaluation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CsEvalType_scope_idx" ON "CsEvalType"("scope");

-- CreateIndex
CREATE INDEX "CsQuestion_scope_idx" ON "CsQuestion"("scope");

-- CreateIndex
CREATE UNIQUE INDEX "CsEvaluation_uid_key" ON "CsEvaluation"("uid");

-- CreateIndex
CREATE INDEX "CsEvaluation_subjectUserId_idx" ON "CsEvaluation"("subjectUserId");

-- CreateIndex
CREATE INDEX "CsEvaluation_status_idx" ON "CsEvaluation"("status");
