-- A MANUAL level, so operator-triggered backups get their own folder instead of
-- consuming a scheduled tier's retention slot (a manual run could previously
-- push out a scheduled archive).
--
-- frequency 'OFF' means it is never DUE, so the scheduler ignores it entirely;
-- it only ever runs when someone presses "Backup now".
-- Idempotent: does nothing if a MANUAL tier already exists.
INSERT INTO "BackupTier" ("key","enabled","frequency","everyN","hourUtc","weekday","dayOfMonth","contents","remotePath","keepLast","sortOrder","updatedAt")
SELECT 'MANUAL', 1, 'OFF', 1, 2, 0, 1, 'FULL',
       (CASE WHEN c."remotePath" IN ('/','') THEN '/manual' ELSE RTRIM(c."remotePath", '/') || '/manual' END),
       10, 4, CURRENT_TIMESTAMP
FROM "BackupConfig" c
WHERE c."singleton" = 'BACKUP'
  AND NOT EXISTS (SELECT 1 FROM "BackupTier" WHERE "key" = 'MANUAL');
