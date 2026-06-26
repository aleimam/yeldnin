/*
  Warnings:

  - You are about to drop the `Department` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `departmentId` on the `Position` table. All the data in the column will be lost.

*/

-- Departments are now the same thing as Teams. Preserve any department NAME that
-- isn't already a team by creating a team for it (no members are added, so nobody's
-- access changes). An employee's department is now their team membership; existing
-- team memberships already reflect most staff's groups, and admins can assign the
-- rest under Users → Departments. Runs BEFORE the Department table is dropped.
INSERT INTO "Team" ("key", "name", "createdAt", "updatedAt")
SELECT 'dept-' || "id", "name", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Department"
WHERE "archivedAt" IS NULL
  AND lower(trim("name")) NOT IN (SELECT lower(trim("name")) FROM "Team");

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Department";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Position" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "titleAr" TEXT,
    "grade" TEXT,
    "description" TEXT,
    "descriptionAr" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" DATETIME,
    "createdById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Position" ("archivedAt", "createdAt", "createdById", "description", "descriptionAr", "grade", "id", "sortOrder", "title", "titleAr", "updatedAt") SELECT "archivedAt", "createdAt", "createdById", "description", "descriptionAr", "grade", "id", "sortOrder", "title", "titleAr", "updatedAt" FROM "Position";
DROP TABLE "Position";
ALTER TABLE "new_Position" RENAME TO "Position";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
