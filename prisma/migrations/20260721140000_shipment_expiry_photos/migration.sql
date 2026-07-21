-- Incoming Shipments, Stage 0a.
--
-- Expiry/lot are PER UNIT (owner decision 2026-07-21): items of the same product
-- in one shipment often carry different expiries, so this cannot live on the
-- shipment or on a per-product line. Veeey groups (product, expiryDate) into its
-- own lots when Sales approve.
ALTER TABLE "Item" ADD COLUMN "expiryDate" DATETIME;
ALTER TABLE "Item" ADD COLUMN "lotCode" TEXT;

-- Shipment photos: Sales review the entered expiry dates against these before
-- approving the stock in, so they are approval evidence, not decoration.
-- CreateTable
CREATE TABLE "ShipmentPhoto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shipmentId" INTEGER NOT NULL,
    "assetId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShipmentPhoto_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ShipmentPhoto_shipmentId_idx" ON "ShipmentPhoto"("shipmentId");
