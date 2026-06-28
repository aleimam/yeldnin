-- Carriers split: a Carrier is a shipping company (logistics), distinct from the
-- last-mile Courier. Patches/Transfers now reference a Carrier — rename their
-- courier columns in place (RENAME COLUMN preserves all existing rows; no rebuild).

-- CreateTable
CREATE TABLE "Carrier" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uid" TEXT,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" DATETIME,
    "createdById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" INTEGER,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Carrier_uid_key" ON "Carrier"("uid");

-- Rename Patch.courierId → carrierId, Patch.courier → carrier (data preserved)
ALTER TABLE "Patch" RENAME COLUMN "courierId" TO "carrierId";
ALTER TABLE "Patch" RENAME COLUMN "courier" TO "carrier";

-- Rename Transfer.courierId → carrierId, Transfer.courier → carrier (data preserved)
ALTER TABLE "Transfer" RENAME COLUMN "courierId" TO "carrierId";
ALTER TABLE "Transfer" RENAME COLUMN "courier" TO "carrier";
