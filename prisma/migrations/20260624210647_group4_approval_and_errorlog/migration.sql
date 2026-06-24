-- CreateTable
CREATE TABLE "ErrorLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "level" TEXT NOT NULL DEFAULT 'error',
    "source" TEXT,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "url" TEXT,
    "method" TEXT,
    "userId" INTEGER,
    "meta" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Request" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uid" TEXT,
    "type" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "customerId" INTEGER,
    "notes" TEXT,
    "deposit" REAL,
    "deliveredAt" DATETIME,
    "approvedById" INTEGER,
    "approvedAt" DATETIME,
    "rejectedNote" TEXT,
    "archivedAt" DATETIME,
    "createdById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" INTEGER,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Request_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Request" ("archivedAt", "createdAt", "createdById", "customerId", "deliveredAt", "deposit", "id", "notes", "scope", "type", "uid", "updatedAt", "updatedById") SELECT "archivedAt", "createdAt", "createdById", "customerId", "deliveredAt", "deposit", "id", "notes", "scope", "type", "uid", "updatedAt", "updatedById" FROM "Request";
-- Grandfather: requests that predate the approval gate are already live → APPROVED.
UPDATE "new_Request" SET "status" = 'APPROVED';
DROP TABLE "Request";
ALTER TABLE "new_Request" RENAME TO "Request";
CREATE UNIQUE INDEX "Request_uid_key" ON "Request"("uid");
CREATE INDEX "Request_scope_idx" ON "Request"("scope");
CREATE INDEX "Request_type_idx" ON "Request"("type");
CREATE INDEX "Request_status_idx" ON "Request"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ErrorLog_createdAt_idx" ON "ErrorLog"("createdAt");

-- CreateIndex
CREATE INDEX "ErrorLog_level_idx" ON "ErrorLog"("level");

-- CreateIndex
CREATE INDEX "ErrorLog_source_idx" ON "ErrorLog"("source");
