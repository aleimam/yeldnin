-- AlterTable
ALTER TABLE "Employee" ADD COLUMN "gender" TEXT;

-- AlterTable
ALTER TABLE "Position" ADD COLUMN "gradeLevel" INTEGER;

-- CreateTable
CREATE TABLE "TeamConnection" (
    "aId" INTEGER NOT NULL,
    "bId" INTEGER NOT NULL,

    PRIMARY KEY ("aId", "bId")
);

-- CreateIndex
CREATE INDEX "TeamConnection_bId_idx" ON "TeamConnection"("bId");
