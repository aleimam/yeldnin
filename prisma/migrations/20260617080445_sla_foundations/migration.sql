-- AlterTable
ALTER TABLE "Item" ADD COLUMN "promisedDeliveryAt" DATETIME;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN "slaClass" TEXT;

-- CreateTable
CREATE TABLE "SlaConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "config" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" DATETIME NOT NULL
);
