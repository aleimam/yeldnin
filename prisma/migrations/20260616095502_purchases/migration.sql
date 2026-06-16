-- CreateTable
CREATE TABLE "Purchase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uid" TEXT,
    "scope" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "supplierId" INTEGER,
    "supplierName" TEXT,
    "purchasePrice" REAL,
    "destinationType" TEXT NOT NULL DEFAULT 'HUB',
    "destinationId" INTEGER,
    "destinationName" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "archivedAt" DATETIME,
    "createdById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" INTEGER,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Purchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_uid_key" ON "Purchase"("uid");

-- CreateIndex
CREATE INDEX "Purchase_scope_idx" ON "Purchase"("scope");

-- CreateIndex
CREATE INDEX "Purchase_status_idx" ON "Purchase"("status");
