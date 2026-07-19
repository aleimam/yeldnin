-- Veeey customer correlation key (contract v2 §2). Nullable; SQLite unique
-- indexes permit many NULLs, so existing non-synced customers are unaffected.
ALTER TABLE "Customer" ADD COLUMN "veeeyCustomerId" TEXT;
CREATE UNIQUE INDEX "Customer_veeeyCustomerId_key" ON "Customer"("veeeyCustomerId");

-- SKU becomes the canonical shared product key (contract v2 §1). Nullable for
-- legacy rows still lacking one; unique across non-null values (audited: 0 dups).
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");
