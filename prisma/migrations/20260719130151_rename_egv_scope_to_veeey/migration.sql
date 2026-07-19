-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Customer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uid" TEXT,
    "name" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'VEEEY',
    "contactChannel" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "contactNumber" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" DATETIME,
    "createdById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" INTEGER,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Customer" ("active", "archivedAt", "contactChannel", "contactNumber", "createdAt", "createdById", "id", "name", "notes", "scope", "uid", "updatedAt", "updatedById") SELECT "active", "archivedAt", "contactChannel", "contactNumber", "createdAt", "createdById", "id", "name", "notes", "scope", "uid", "updatedAt", "updatedById" FROM "Customer";
DROP TABLE "Customer";
ALTER TABLE "new_Customer" RENAME TO "Customer";
CREATE UNIQUE INDEX "Customer_uid_key" ON "Customer"("uid");
CREATE INDEX "Customer_scope_idx" ON "Customer"("scope");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Rename the business-line scope VALUE: EGV -> VEEEY, in every scoped table.
-- (CS Quality's scope columns carry CALL|PERFORMANCE|PERIODICAL — untouched.)
UPDATE "Product"  SET "scope" = 'VEEEY' WHERE "scope" = 'EGV';
UPDATE "Customer" SET "scope" = 'VEEEY' WHERE "scope" = 'EGV';
UPDATE "Issue"    SET "scope" = 'VEEEY' WHERE "scope" = 'EGV';
UPDATE "Shipment" SET "scope" = 'VEEEY' WHERE "scope" = 'EGV';
UPDATE "Item"     SET "scope" = 'VEEEY' WHERE "scope" = 'EGV';
UPDATE "Request"  SET "scope" = 'VEEEY' WHERE "scope" = 'EGV';
UPDATE "Purchase" SET "scope" = 'VEEEY' WHERE "scope" = 'EGV';
UPDATE "Patch"    SET "scope" = 'VEEEY' WHERE "scope" = 'EGV';
