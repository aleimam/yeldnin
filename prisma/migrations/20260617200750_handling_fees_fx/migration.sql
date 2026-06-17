-- AlterTable
ALTER TABLE "Patch" ADD COLUMN "handlingFee" REAL;
ALTER TABLE "Patch" ADD COLUMN "handlingFeeCurrency" TEXT;

-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN "handlingFee" REAL;
ALTER TABLE "Purchase" ADD COLUMN "handlingFeeCurrency" TEXT;

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN "handlingFee" REAL;
ALTER TABLE "Trip" ADD COLUMN "handlingFeeCurrency" TEXT;

-- CreateTable
CREATE TABLE "FxRateCache" (
    "currency" TEXT NOT NULL PRIMARY KEY,
    "rate" REAL NOT NULL,
    "fetchedAt" DATETIME NOT NULL
);
