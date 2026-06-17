-- AlterTable
ALTER TABLE "Item" ADD COLUMN "purchaseCurrency" TEXT;

-- AlterTable
ALTER TABLE "Request" ADD COLUMN "deliveredAt" DATETIME;

-- AlterTable
ALTER TABLE "RequestLine" ADD COLUMN "purchaseCurrency" TEXT;
