-- CreateTable
CREATE TABLE "EvalResult" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cycleId" INTEGER NOT NULL,
    "subjectEmpId" INTEGER NOT NULL,
    "scope" TEXT NOT NULL,
    "pillarId" INTEGER,
    "criterionId" INTEGER,
    "score" REAL NOT NULL,
    "selfScore" REAL,
    "responses" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "EvalFeedback" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cycleId" INTEGER NOT NULL,
    "subjectEmpId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_GENERATED',
    "adminNote" TEXT,
    "draftMd" TEXT,
    "editedMd" TEXT,
    "model" TEXT,
    "effortCoverage" REAL,
    "effortDepth" REAL,
    "effortScore" REAL,
    "generatedAt" DATETIME,
    "releasedAt" DATETIME,
    "error" TEXT
);

-- CreateIndex
CREATE INDEX "EvalResult_cycleId_subjectEmpId_idx" ON "EvalResult"("cycleId", "subjectEmpId");

-- CreateIndex
CREATE INDEX "EvalResult_cycleId_scope_idx" ON "EvalResult"("cycleId", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "EvalFeedback_cycleId_subjectEmpId_key" ON "EvalFeedback"("cycleId", "subjectEmpId");
