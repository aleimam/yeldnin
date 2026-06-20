-- CreateTable
CREATE TABLE "Inquiry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uid" TEXT,
    "unitKind" TEXT NOT NULL,
    "unitId" INTEGER NOT NULL,
    "initiatorId" INTEGER NOT NULL,
    "initiatorTeamId" INTEGER,
    "recipientUserId" INTEGER NOT NULL,
    "recipientTeamId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "dispositionId" INTEGER,
    "answeredAt" DATETIME,
    "closedAt" DATETIME,
    "closedById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Inquiry_initiatorId_fkey" FOREIGN KEY ("initiatorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Inquiry_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Inquiry_dispositionId_fkey" FOREIGN KEY ("dispositionId") REFERENCES "InquiryDisposition" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InquiryMessage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "inquiryId" INTEGER NOT NULL,
    "senderId" INTEGER NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InquiryMessage_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "Inquiry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InquiryMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InquiryAttachment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "messageId" INTEGER NOT NULL,
    "assetId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InquiryAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "InquiryMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InquiryDisposition" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "labelAr" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Inquiry_uid_key" ON "Inquiry"("uid");

-- CreateIndex
CREATE INDEX "Inquiry_unitKind_unitId_idx" ON "Inquiry"("unitKind", "unitId");

-- CreateIndex
CREATE INDEX "Inquiry_initiatorId_idx" ON "Inquiry"("initiatorId");

-- CreateIndex
CREATE INDEX "Inquiry_recipientTeamId_idx" ON "Inquiry"("recipientTeamId");

-- CreateIndex
CREATE INDEX "Inquiry_initiatorTeamId_idx" ON "Inquiry"("initiatorTeamId");

-- CreateIndex
CREATE INDEX "Inquiry_status_idx" ON "Inquiry"("status");

-- CreateIndex
CREATE INDEX "InquiryMessage_inquiryId_idx" ON "InquiryMessage"("inquiryId");

-- CreateIndex
CREATE INDEX "InquiryAttachment_messageId_idx" ON "InquiryAttachment"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "InquiryDisposition_key_key" ON "InquiryDisposition"("key");
