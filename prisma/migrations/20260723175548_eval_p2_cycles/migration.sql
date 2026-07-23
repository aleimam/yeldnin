-- CreateTable
CREATE TABLE "EvalCycle" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadline" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "effortWeight" INTEGER NOT NULL DEFAULT 15,
    "aiModel" TEXT,
    "createdById" INTEGER,
    "closedAt" DATETIME
);

-- CreateTable
CREATE TABLE "EvalCycleTeam" (
    "cycleId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,

    PRIMARY KEY ("cycleId", "teamId"),
    CONSTRAINT "EvalCycleTeam_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "EvalCycle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EvalCycleParticipant" (
    "cycleId" INTEGER NOT NULL,
    "empId" INTEGER NOT NULL,
    "grade" INTEGER,
    "teamIds" TEXT NOT NULL,

    PRIMARY KEY ("cycleId", "empId")
);

-- CreateTable
CREATE TABLE "EvalCycleCriterion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cycleId" INTEGER NOT NULL,
    "criterionId" INTEGER NOT NULL,
    "pillarId" INTEGER NOT NULL,
    "pillarName" TEXT NOT NULL,
    "pillarNameAr" TEXT,
    "pillarOrder" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "titleAr" TEXT,
    "text" TEXT NOT NULL,
    "textAr" TEXT,
    "raterScope" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "teamIds" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "EvalCycleEdge" (
    "cycleId" INTEGER NOT NULL,
    "aId" INTEGER NOT NULL,
    "bId" INTEGER NOT NULL,

    PRIMARY KEY ("cycleId", "aId", "bId")
);

-- CreateTable
CREATE TABLE "Evaluation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cycleId" INTEGER NOT NULL,
    "evaluatorEmpId" INTEGER NOT NULL,
    "subjectEmpId" INTEGER NOT NULL,
    "isSelf" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "overallComment" TEXT,
    "submittedAt" DATETIME
);

-- CreateTable
CREATE TABLE "EvalAnswer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "evaluationId" INTEGER NOT NULL,
    "criterionId" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "note" TEXT,
    CONSTRAINT "EvalAnswer_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "EvalCycle_uid_key" ON "EvalCycle"("uid");

-- CreateIndex
CREATE INDEX "EvalCycle_status_idx" ON "EvalCycle"("status");

-- CreateIndex
CREATE INDEX "EvalCycleParticipant_cycleId_idx" ON "EvalCycleParticipant"("cycleId");

-- CreateIndex
CREATE INDEX "EvalCycleCriterion_cycleId_idx" ON "EvalCycleCriterion"("cycleId");

-- CreateIndex
CREATE INDEX "Evaluation_cycleId_evaluatorEmpId_idx" ON "Evaluation"("cycleId", "evaluatorEmpId");

-- CreateIndex
CREATE INDEX "Evaluation_cycleId_subjectEmpId_idx" ON "Evaluation"("cycleId", "subjectEmpId");

-- CreateIndex
CREATE UNIQUE INDEX "Evaluation_cycleId_evaluatorEmpId_subjectEmpId_key" ON "Evaluation"("cycleId", "evaluatorEmpId", "subjectEmpId");

-- CreateIndex
CREATE UNIQUE INDEX "EvalAnswer_evaluationId_criterionId_key" ON "EvalAnswer"("evaluationId", "criterionId");
