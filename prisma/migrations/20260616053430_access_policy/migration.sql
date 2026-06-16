-- CreateTable
CREATE TABLE "AccessPolicy" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "overrides" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" DATETIME NOT NULL
);
