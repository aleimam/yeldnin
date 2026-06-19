-- AlterTable
ALTER TABLE "Item" ADD COLUMN "exceptionAt" DATETIME;
ALTER TABLE "Item" ADD COLUMN "exceptionById" INTEGER;
ALTER TABLE "Item" ADD COLUMN "exceptionIssueId" INTEGER;
ALTER TABLE "Item" ADD COLUMN "exceptionNote" TEXT;
