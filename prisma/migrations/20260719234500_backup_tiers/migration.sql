-- Independent backup tiers: each level gets its own cadence, contents, remote
-- folder and retention. Replaces the single schedule + GFS pruning.

CREATE TABLE "BackupTier" (
    "id"         INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key"        TEXT    NOT NULL,
    "enabled"    BOOLEAN NOT NULL DEFAULT true,
    "frequency"  TEXT    NOT NULL DEFAULT 'DAILY',
    "everyN"     INTEGER NOT NULL DEFAULT 1,
    "hourUtc"    INTEGER NOT NULL DEFAULT 2,
    "weekday"    INTEGER NOT NULL DEFAULT 0,
    "dayOfMonth" INTEGER NOT NULL DEFAULT 1,
    "contents"   TEXT    NOT NULL DEFAULT 'FULL',
    "remotePath" TEXT    NOT NULL DEFAULT '/',
    "keepLast"   INTEGER NOT NULL DEFAULT 7,
    "sortOrder"  INTEGER NOT NULL DEFAULT 0,
    "lastRunAt"  DATETIME,
    "updatedAt"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "BackupTier_key_key" ON "BackupTier"("key");

-- Which tier produced a run (null for everything recorded before tiers).
ALTER TABLE "BackupRun" ADD COLUMN "tierKey" TEXT;

-- Seed the three levels FROM the existing configuration, so an upgrade keeps
-- the operator's current cadence/retention instead of silently resetting it.
-- Each tier gets its own subfolder under the configured remote path.
INSERT INTO "BackupTier" ("key","enabled","frequency","everyN","hourUtc","weekday","dayOfMonth","contents","remotePath","keepLast","sortOrder","updatedAt")
SELECT 'HOURLY', 1, 'HOURLY', 1, c."hourUtc", 0, 1, 'DB',
       (CASE WHEN c."remotePath" IN ('/','') THEN '/hourly' ELSE RTRIM(c."remotePath", '/') || '/hourly' END),
       c."keepHourly", 1, CURRENT_TIMESTAMP
FROM "BackupConfig" c WHERE c."singleton" = 'BACKUP';

INSERT INTO "BackupTier" ("key","enabled","frequency","everyN","hourUtc","weekday","dayOfMonth","contents","remotePath","keepLast","sortOrder","updatedAt")
SELECT 'DAILY', 1, 'DAILY', 1, c."hourUtc", 0, 1, 'FULL',
       (CASE WHEN c."remotePath" IN ('/','') THEN '/daily' ELSE RTRIM(c."remotePath", '/') || '/daily' END),
       c."keepDaily", 2, CURRENT_TIMESTAMP
FROM "BackupConfig" c WHERE c."singleton" = 'BACKUP';

INSERT INTO "BackupTier" ("key","enabled","frequency","everyN","hourUtc","weekday","dayOfMonth","contents","remotePath","keepLast","sortOrder","updatedAt")
SELECT 'WEEKLY', 1, 'WEEKLY', 1, c."hourUtc", 0, 1, 'FULL',
       (CASE WHEN c."remotePath" IN ('/','') THEN '/weekly' ELSE RTRIM(c."remotePath", '/') || '/weekly' END),
       c."keepWeekly", 3, CURRENT_TIMESTAMP
FROM "BackupConfig" c WHERE c."singleton" = 'BACKUP';
