-- CreateTable
CREATE TABLE "TripMark" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tripId" INTEGER NOT NULL,
    "team" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "byUserId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TripMark_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TripMarkPhoto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "markId" INTEGER NOT NULL,
    "assetId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TripMarkPhoto_markId_fkey" FOREIGN KEY ("markId") REFERENCES "TripMark" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TripMark_tripId_idx" ON "TripMark"("tripId");

-- CreateIndex
CREATE UNIQUE INDEX "TripMark_tripId_team_key" ON "TripMark"("tripId", "team");

-- CreateIndex
CREATE INDEX "TripMarkPhoto_markId_idx" ON "TripMarkPhoto"("markId");
