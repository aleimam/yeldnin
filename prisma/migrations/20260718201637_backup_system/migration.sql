-- CreateTable
CREATE TABLE "BackupConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "singleton" TEXT NOT NULL DEFAULT 'BACKUP',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "protocol" TEXT NOT NULL DEFAULT 'FTPS',
    "host" TEXT,
    "port" INTEGER NOT NULL DEFAULT 21,
    "username" TEXT,
    "passwordEnc" TEXT,
    "remotePath" TEXT NOT NULL DEFAULT '/',
    "secure" BOOLEAN NOT NULL DEFAULT true,
    "includeDb" BOOLEAN NOT NULL DEFAULT true,
    "includeUploads" BOOLEAN NOT NULL DEFAULT false,
    "frequency" TEXT NOT NULL DEFAULT 'DAILY',
    "hourUtc" INTEGER NOT NULL DEFAULT 2,
    "weekday" INTEGER NOT NULL DEFAULT 1,
    "dayOfMonth" INTEGER NOT NULL DEFAULT 1,
    "retentionKeep" INTEGER NOT NULL DEFAULT 30,
    "notifyOnFailure" BOOLEAN NOT NULL DEFAULT true,
    "lastTestAt" DATETIME,
    "lastTestOk" BOOLEAN,
    "lastTestMessage" TEXT,
    "lastRunAt" DATETIME,
    "createdById" INTEGER,
    "updatedById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BackupRun" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "trigger" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "contents" TEXT NOT NULL DEFAULT '',
    "fileName" TEXT,
    "sizeBytes" INTEGER,
    "error" TEXT,
    "byUserId" INTEGER
);

-- CreateIndex
CREATE UNIQUE INDEX "BackupConfig_singleton_key" ON "BackupConfig"("singleton");

-- CreateIndex
CREATE INDEX "BackupRun_startedAt_idx" ON "BackupRun"("startedAt");
