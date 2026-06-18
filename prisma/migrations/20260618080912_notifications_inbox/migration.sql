-- CreateTable
CREATE TABLE "NotificationMessage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "imageAssetId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'info',
    "senderId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "NotificationRecipient" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "messageId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "readAt" DATETIME,
    CONSTRAINT "NotificationRecipient_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "NotificationMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "NotificationRecipient_userId_idx" ON "NotificationRecipient"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationRecipient_messageId_userId_key" ON "NotificationRecipient"("messageId", "userId");
