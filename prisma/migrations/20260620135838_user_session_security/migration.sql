-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uid" TEXT,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "fullName" TEXT,
    "fullNameAr" TEXT,
    "username" TEXT,
    "email" TEXT NOT NULL,
    "primaryPhone" TEXT,
    "secondaryPhone" TEXT,
    "yeldnPhone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'MEMBER',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "themeKey" TEXT,
    "colorMode" TEXT NOT NULL DEFAULT 'system',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "avatarUrl" TEXT,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "archivedAt" DATETIME
);
INSERT INTO "new_User" ("active", "archivedAt", "avatarUrl", "colorMode", "createdAt", "email", "fullName", "fullNameAr", "id", "locale", "name", "nameAr", "passwordHash", "primaryPhone", "secondaryPhone", "themeKey", "tier", "uid", "updatedAt", "username", "yeldnPhone") SELECT "active", "archivedAt", "avatarUrl", "colorMode", "createdAt", "email", "fullName", "fullNameAr", "id", "locale", "name", "nameAr", "passwordHash", "primaryPhone", "secondaryPhone", "themeKey", "tier", "uid", "updatedAt", "username", "yeldnPhone" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_uid_key" ON "User"("uid");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
