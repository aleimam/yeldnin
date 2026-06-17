-- CreateTable
CREATE TABLE "NotificationRule" (
    "event" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "notifyAdmins" BOOLEAN NOT NULL DEFAULT false,
    "notifyOrderCreator" BOOLEAN NOT NULL DEFAULT false,
    "moduleKeys" TEXT NOT NULL DEFAULT '',
    "statuses" TEXT NOT NULL DEFAULT '',
    "updatedById" INTEGER,
    "updatedAt" DATETIME NOT NULL
);
