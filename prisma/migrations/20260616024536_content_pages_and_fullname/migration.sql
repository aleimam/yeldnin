-- AlterTable
ALTER TABLE "User" ADD COLUMN "fullName" TEXT;

-- CreateTable
CREATE TABLE "ContentPage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL DEFAULT '',
    "bodyEn" TEXT NOT NULL DEFAULT '',
    "bodyAr" TEXT NOT NULL DEFAULT '',
    "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "showInFooter" BOOLEAN NOT NULL DEFAULT true,
    "showInMenu" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" INTEGER,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ContentPage_slug_key" ON "ContentPage"("slug");

-- CreateIndex
CREATE INDEX "ContentPage_published_idx" ON "ContentPage"("published");
