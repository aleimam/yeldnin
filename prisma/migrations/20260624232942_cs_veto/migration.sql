-- CreateTable
CREATE TABLE "CsVeto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "evaluationId" INTEGER NOT NULL,
    "byUserId" INTEGER NOT NULL,
    "note" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "resolvedById" INTEGER,
    "resolvedAt" DATETIME,
    "resolutionNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CsVeto_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "CsEvaluation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CsVeto_evaluationId_key" ON "CsVeto"("evaluationId");

-- CreateIndex
CREATE INDEX "CsVeto_byUserId_createdAt_idx" ON "CsVeto"("byUserId", "createdAt");

-- CreateIndex
CREATE INDEX "CsVeto_status_idx" ON "CsVeto"("status");
