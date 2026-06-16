-- CreateTable
CREATE TABLE "Shipment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uid" TEXT,
    "scope" TEXT NOT NULL,
    "tripId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'OFFICE',
    "archivedAt" DATETIME,
    "createdById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" INTEGER,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Shipment_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_uid_key" ON "Shipment"("uid");

-- CreateIndex
CREATE INDEX "Shipment_scope_idx" ON "Shipment"("scope");

-- CreateIndex
CREATE INDEX "Shipment_status_idx" ON "Shipment"("status");
