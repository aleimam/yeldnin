-- AlterTable
ALTER TABLE "ExpenseTransaction" ADD COLUMN "accruingDate" DATETIME;
ALTER TABLE "ExpenseTransaction" ADD COLUMN "flag" TEXT;
ALTER TABLE "ExpenseTransaction" ADD COLUMN "flagNote" TEXT;
ALTER TABLE "ExpenseTransaction" ADD COLUMN "flaggedAt" DATETIME;
ALTER TABLE "ExpenseTransaction" ADD COLUMN "flaggedById" INTEGER;

-- CreateIndex
CREATE INDEX "ExpenseTransaction_flag_idx" ON "ExpenseTransaction"("flag");

-- Backfill: legacy rows had no accruing date; seed it from the registering date so
-- both date columns render for historical transactions.
UPDATE "ExpenseTransaction" SET "accruingDate" = "createdAt" WHERE "accruingDate" IS NULL;
