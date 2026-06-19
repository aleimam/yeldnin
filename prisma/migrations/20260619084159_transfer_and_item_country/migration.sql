-- AlterTable
ALTER TABLE "Item" ADD COLUMN "country" TEXT;

-- CreateTable
CREATE TABLE "Transfer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uid" TEXT,
    "country" TEXT NOT NULL,
    "fromType" TEXT NOT NULL,
    "fromId" INTEGER NOT NULL,
    "fromName" TEXT,
    "toType" TEXT NOT NULL,
    "toId" INTEGER NOT NULL,
    "toName" TEXT,
    "tracking" TEXT,
    "courierId" INTEGER,
    "courier" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "leftOriginAt" DATETIME,
    "deliveredAt" DATETIME,
    "receivedAt" DATETIME,
    "notes" TEXT,
    "archivedAt" DATETIME,
    "createdById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" INTEGER,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TransferPhoto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "transferId" INTEGER NOT NULL,
    "assetId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TransferPhoto_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_uid_key" ON "Transfer"("uid");

-- CreateIndex
CREATE INDEX "Transfer_status_idx" ON "Transfer"("status");

-- CreateIndex
CREATE INDEX "Transfer_fromType_fromId_idx" ON "Transfer"("fromType", "fromId");

-- CreateIndex
CREATE INDEX "Transfer_toType_toId_idx" ON "Transfer"("toType", "toId");

-- CreateIndex
CREATE INDEX "TransferPhoto_transferId_idx" ON "TransferPhoto"("transferId");
