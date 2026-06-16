-- CreateTable
CREATE TABLE "Item" (
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
    "sellingPrice" REAL,
    "purchasePrice" REAL,
    "receivedAt" DATETIME,
    "transitAt" DATETIME,
    "globalShippingAt" DATETIME,
    "notes" TEXT,
    "createdById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Item_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItemEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "itemId" INTEGER NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "containerType" TEXT,
    "containerId" INTEGER,
    "action" TEXT,
    "byUserId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ItemEvent_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Item_uid_key" ON "Item"("uid");

-- CreateIndex
CREATE INDEX "Item_status_idx" ON "Item"("status");

-- CreateIndex
CREATE INDEX "Item_scope_idx" ON "Item"("scope");

-- CreateIndex
CREATE INDEX "Item_containerType_containerId_idx" ON "Item"("containerType", "containerId");

-- CreateIndex
CREATE INDEX "Item_requestId_idx" ON "Item"("requestId");

-- CreateIndex
CREATE INDEX "Item_exceptionFlag_idx" ON "Item"("exceptionFlag");

-- CreateIndex
CREATE INDEX "ItemEvent_itemId_idx" ON "ItemEvent"("itemId");
