-- CreateTable
CREATE TABLE "Supplier" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "availableUSA" BOOLEAN NOT NULL DEFAULT false,
    "availableUK" BOOLEAN NOT NULL DEFAULT false,
    "availableEU" BOOLEAN NOT NULL DEFAULT false,
    "contact" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PricingCalculation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "section" TEXT NOT NULL,
    "productName" TEXT,
    "importedFrom" TEXT NOT NULL,
    "supplierId" INTEGER,
    "supplierName" TEXT,
    "price" REAL NOT NULL,
    "inputJson" TEXT NOT NULL,
    "configJson" TEXT NOT NULL,
    "notes" TEXT,
    "userId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "deletedById" INTEGER,
    CONSTRAINT "PricingCalculation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PricingPhoto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "calculationId" INTEGER NOT NULL,
    "assetId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PricingPhoto_calculationId_fkey" FOREIGN KEY ("calculationId") REFERENCES "PricingCalculation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PricingSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "config" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "PricingCalculation_section_idx" ON "PricingCalculation"("section");

-- CreateIndex
CREATE INDEX "PricingCalculation_userId_idx" ON "PricingCalculation"("userId");

-- CreateIndex
CREATE INDEX "PricingPhoto_calculationId_idx" ON "PricingPhoto"("calculationId");
