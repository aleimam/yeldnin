-- CreateTable
CREATE TABLE "Patch" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uid" TEXT,
    "purchaseId" INTEGER,
    "scope" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "supplierName" TEXT,
    "destinationType" TEXT NOT NULL DEFAULT 'HUB',
    "destinationId" INTEGER,
    "destinationName" TEXT,
    "tracking" TEXT,
    "courier" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DISPATCHED',
    "dispatchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" DATETIME,
    "receivedAt" DATETIME,
    "notes" TEXT,
    "archivedAt" DATETIME,
    "createdById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" INTEGER,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Patch_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PatchPhoto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "patchId" INTEGER NOT NULL,
    "assetId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PatchPhoto_patchId_fkey" FOREIGN KEY ("patchId") REFERENCES "Patch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Patch_uid_key" ON "Patch"("uid");

-- CreateIndex
CREATE INDEX "Patch_scope_idx" ON "Patch"("scope");

-- CreateIndex
CREATE INDEX "Patch_status_idx" ON "Patch"("status");

-- CreateIndex
CREATE INDEX "PatchPhoto_patchId_idx" ON "PatchPhoto"("patchId");
