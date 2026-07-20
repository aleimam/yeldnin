-- CreateTable
CREATE TABLE "Delivery" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uid" TEXT NOT NULL,
    "storeKey" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'VEEEY',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "placedAt" DATETIME,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "customerAltPhone" TEXT,
    "addressZone" TEXT,
    "addressSubArea" TEXT,
    "addressText" TEXT NOT NULL,
    "addressMapUrl" TEXT,
    "collectPiastres" INTEGER NOT NULL DEFAULT 0,
    "collectedPiastres" INTEGER,
    "paymentMethod" TEXT NOT NULL DEFAULT 'COD',
    "promisedDate" DATETIME,
    "promisedSlot" TEXT,
    "courierId" INTEGER,
    "failureReason" TEXT,
    "cancelReason" TEXT,
    "notes" TEXT,
    "courierNote" TEXT,
    "deliveredAt" DATETIME,
    "closedAt" DATETIME,
    "reviewFlag" BOOLEAN NOT NULL DEFAULT false,
    "reviewNote" TEXT,
    "bounceCount" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" DATETIME,
    "createdById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" INTEGER,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Delivery_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "Courier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeliveryLine" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "deliveryId" INTEGER NOT NULL,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "DeliveryLine_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeliveryPhoto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "deliveryId" INTEGER NOT NULL,
    "assetId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeliveryPhoto_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeliveryEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "deliveryId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "byUserId" INTEGER,
    "reason" TEXT,
    "note" TEXT,
    CONSTRAINT "DeliveryEvent_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
--
-- TWO tables are rebuilt below. SQLite cannot ALTER a table to add a foreign
-- key, so Prisma's rebuild-and-copy is the only way to do either.
--
--  1. "Courier"    — expected. Gains the optional `userId` FK so an Ops user can
--                    also be a courier (DELIVERIES §5).
--
--  2. "BackupTier" — NOT related to deliveries, and worth explaining. The
--     20260719234500_backup_tiers migration was hand-written, and gave
--     `updatedAt` a `DEFAULT CURRENT_TIMESTAMP` that Prisma's canonical form for
--     an `@updatedAt` column does not have. That one-word difference is real
--     schema drift: Prisma re-detects it and would regenerate this same rebuild
--     inside EVERY future migration until it is resolved. Resolving it here.
--
--     Safe to run: the INSERT…SELECT lists all 14 columns, and the live table on
--     production was verified (2026-07-20) to be byte-identical to this one,
--     holding the four configured tiers (HOURLY/DAILY/WEEKLY/MANUAL). Dropping
--     the DB-level default changes nothing at runtime — Prisma always writes
--     `updatedAt` itself, and nothing inserts into this table via raw SQL.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BackupTier" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "frequency" TEXT NOT NULL DEFAULT 'DAILY',
    "everyN" INTEGER NOT NULL DEFAULT 1,
    "hourUtc" INTEGER NOT NULL DEFAULT 2,
    "weekday" INTEGER NOT NULL DEFAULT 0,
    "dayOfMonth" INTEGER NOT NULL DEFAULT 1,
    "contents" TEXT NOT NULL DEFAULT 'FULL',
    "remotePath" TEXT NOT NULL DEFAULT '/',
    "keepLast" INTEGER NOT NULL DEFAULT 7,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "lastRunAt" DATETIME,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_BackupTier" ("contents", "dayOfMonth", "enabled", "everyN", "frequency", "hourUtc", "id", "keepLast", "key", "lastRunAt", "remotePath", "sortOrder", "updatedAt", "weekday") SELECT "contents", "dayOfMonth", "enabled", "everyN", "frequency", "hourUtc", "id", "keepLast", "key", "lastRunAt", "remotePath", "sortOrder", "updatedAt", "weekday" FROM "BackupTier";
DROP TABLE "BackupTier";
ALTER TABLE "new_BackupTier" RENAME TO "BackupTier";
CREATE UNIQUE INDEX "BackupTier_key_key" ON "BackupTier"("key");
CREATE TABLE "new_Courier" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uid" TEXT,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "userId" INTEGER,
    "archivedAt" DATETIME,
    "createdById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" INTEGER,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Courier_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Courier" ("active", "archivedAt", "contact", "createdAt", "createdById", "id", "name", "uid", "updatedAt", "updatedById") SELECT "active", "archivedAt", "contact", "createdAt", "createdById", "id", "name", "uid", "updatedAt", "updatedById" FROM "Courier";
DROP TABLE "Courier";
ALTER TABLE "new_Courier" RENAME TO "Courier";
CREATE UNIQUE INDEX "Courier_uid_key" ON "Courier"("uid");
CREATE UNIQUE INDEX "Courier_userId_key" ON "Courier"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Delivery_uid_key" ON "Delivery"("uid");

-- CreateIndex
CREATE INDEX "Delivery_status_idx" ON "Delivery"("status");

-- CreateIndex
CREATE INDEX "Delivery_courierId_status_idx" ON "Delivery"("courierId", "status");

-- CreateIndex
CREATE INDEX "Delivery_promisedDate_idx" ON "Delivery"("promisedDate");

-- CreateIndex
CREATE UNIQUE INDEX "Delivery_storeKey_orderNumber_key" ON "Delivery"("storeKey", "orderNumber");

-- CreateIndex
CREATE INDEX "DeliveryLine_deliveryId_idx" ON "DeliveryLine"("deliveryId");

-- CreateIndex
CREATE INDEX "DeliveryPhoto_deliveryId_idx" ON "DeliveryPhoto"("deliveryId");

-- CreateIndex
CREATE INDEX "DeliveryEvent_deliveryId_at_idx" ON "DeliveryEvent"("deliveryId", "at");
