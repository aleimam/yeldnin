-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Item" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uid" TEXT,
    "productId" INTEGER NOT NULL,
    "scope" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "containerType" TEXT,
    "containerId" INTEGER,
    "requestId" INTEGER,
    "exceptionFlag" TEXT,
    "sourceContainerType" TEXT,
    "sourceContainerId" INTEGER,
    "isSpecialOrder" BOOLEAN NOT NULL DEFAULT false,
    "isGift" BOOLEAN NOT NULL DEFAULT false,
    "slaAlertedStatus" TEXT,
    "sellingPrice" REAL,
    "purchasePrice" REAL,
    "purchaseCurrency" TEXT,
    "receivedAt" DATETIME,
    "promisedDeliveryAt" DATETIME,
    "transitAt" DATETIME,
    "globalShippingAt" DATETIME,
    "notes" TEXT,
    "createdById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Item_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Item" ("containerId", "containerType", "createdAt", "createdById", "exceptionFlag", "globalShippingAt", "id", "isSpecialOrder", "notes", "productId", "promisedDeliveryAt", "purchaseCurrency", "purchasePrice", "receivedAt", "requestId", "scope", "sellingPrice", "slaAlertedStatus", "sourceContainerId", "sourceContainerType", "status", "transitAt", "uid", "updatedAt") SELECT "containerId", "containerType", "createdAt", "createdById", "exceptionFlag", "globalShippingAt", "id", "isSpecialOrder", "notes", "productId", "promisedDeliveryAt", "purchaseCurrency", "purchasePrice", "receivedAt", "requestId", "scope", "sellingPrice", "slaAlertedStatus", "sourceContainerId", "sourceContainerType", "status", "transitAt", "uid", "updatedAt" FROM "Item";
DROP TABLE "Item";
ALTER TABLE "new_Item" RENAME TO "Item";
CREATE UNIQUE INDEX "Item_uid_key" ON "Item"("uid");
CREATE INDEX "Item_status_idx" ON "Item"("status");
CREATE INDEX "Item_scope_idx" ON "Item"("scope");
CREATE INDEX "Item_containerType_containerId_idx" ON "Item"("containerType", "containerId");
CREATE INDEX "Item_requestId_idx" ON "Item"("requestId");
CREATE INDEX "Item_exceptionFlag_idx" ON "Item"("exceptionFlag");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
