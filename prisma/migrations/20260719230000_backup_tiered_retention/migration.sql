-- Tiered (grandfather-father-son) backup retention.
-- Purely additive: every column has a default, so the existing single row and
-- the current non-tiered behaviour are untouched until `tiered` is switched on.
ALTER TABLE "BackupConfig" ADD COLUMN "tiered" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BackupConfig" ADD COLUMN "keepHourly" INTEGER NOT NULL DEFAULT 24;
ALTER TABLE "BackupConfig" ADD COLUMN "keepDaily" INTEGER NOT NULL DEFAULT 7;
ALTER TABLE "BackupConfig" ADD COLUMN "keepWeekly" INTEGER NOT NULL DEFAULT 8;
ALTER TABLE "BackupConfig" ADD COLUMN "lastFullAt" DATETIME;
