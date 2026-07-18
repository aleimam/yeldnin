-- AlterTable
ALTER TABLE "Product" ADD COLUMN "veeeyWpId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Product_veeeyWpId_key" ON "Product"("veeeyWpId");
