-- CreateTable
CREATE TABLE "Trip" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uid" TEXT,
    "travelerId" INTEGER NOT NULL,
    "country" TEXT NOT NULL,
    "maxWeight" REAL,
    "dealPricePerKg" REAL,
    "lastReceivingDate" DATETIME,
    "deliveryDateInEgypt" DATETIME,
    "allowedProductTypes" TEXT NOT NULL DEFAULT '',
    "maleSupport" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "archivedAt" DATETIME,
    "createdById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" INTEGER,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Trip_travelerId_fkey" FOREIGN KEY ("travelerId") REFERENCES "Traveler" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Trip_uid_key" ON "Trip"("uid");

-- CreateIndex
CREATE INDEX "Trip_status_idx" ON "Trip"("status");
