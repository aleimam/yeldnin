-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PlatformSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "appName" TEXT NOT NULL DEFAULT 'YeldnIN',
    "brandColor" TEXT NOT NULL DEFAULT '37 99 235',
    "themeKey" TEXT NOT NULL DEFAULT 'default',
    "logoUrl" TEXT,
    "darkLogoUrl" TEXT,
    "faviconUrl" TEXT,
    "version" TEXT NOT NULL DEFAULT '0.1.0',
    "versionShowMobile" BOOLEAN NOT NULL DEFAULT false,
    "versionShowDesktop" BOOLEAN NOT NULL DEFAULT true,
    "copyrightEn" TEXT,
    "copyrightAr" TEXT,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_PlatformSettings" ("appName", "brandColor", "darkLogoUrl", "faviconUrl", "id", "logoUrl", "themeKey", "updatedAt", "version") SELECT "appName", "brandColor", "darkLogoUrl", "faviconUrl", "id", "logoUrl", "themeKey", "updatedAt", "version" FROM "PlatformSettings";
DROP TABLE "PlatformSettings";
ALTER TABLE "new_PlatformSettings" RENAME TO "PlatformSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
