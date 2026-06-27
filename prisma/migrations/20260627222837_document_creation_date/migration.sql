-- AlterTable
ALTER TABLE "Document" ADD COLUMN "creationDate" DATETIME;

-- Backfill existing documents: the stated creation date defaults to the
-- record-created timestamp (so the field is populated and editable).
UPDATE "Document" SET "creationDate" = "createdAt" WHERE "creationDate" IS NULL;
