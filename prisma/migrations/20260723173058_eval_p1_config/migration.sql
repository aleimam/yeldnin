-- CreateTable
CREATE TABLE "EvalPillar" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" DATETIME
);

-- CreateTable
CREATE TABLE "EvalPillarTeam" (
    "pillarId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,

    PRIMARY KEY ("pillarId", "teamId"),
    CONSTRAINT "EvalPillarTeam_pillarId_fkey" FOREIGN KEY ("pillarId") REFERENCES "EvalPillar" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EvalCriterion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pillarId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "titleAr" TEXT,
    "text" TEXT NOT NULL,
    "textAr" TEXT,
    "raterScope" TEXT NOT NULL DEFAULT 'ANY',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" DATETIME,
    CONSTRAINT "EvalCriterion_pillarId_fkey" FOREIGN KEY ("pillarId") REFERENCES "EvalPillar" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "EvalPillarTeam_teamId_idx" ON "EvalPillarTeam"("teamId");

-- CreateIndex
CREATE INDEX "EvalCriterion_pillarId_idx" ON "EvalCriterion"("pillarId");
