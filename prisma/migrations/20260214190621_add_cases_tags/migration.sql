-- CreateTable
CREATE TABLE "Case" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "caseNumber" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Case_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6c757d',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Tag_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecordTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecordTag_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "Record" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RecordTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Record" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "originalDeviceId" TEXT,
    "currentVersionId" TEXT,
    "caseId" TEXT,
    CONSTRAINT "Record_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "RecordVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Record_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Record_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Record" ("createdAt", "currentVersionId", "id", "originalDeviceId", "ownerUserId", "status") SELECT "createdAt", "currentVersionId", "id", "originalDeviceId", "ownerUserId", "status" FROM "Record";
DROP TABLE "Record";
ALTER TABLE "new_Record" RENAME TO "Record";
CREATE UNIQUE INDEX "Record_currentVersionId_key" ON "Record"("currentVersionId");
CREATE INDEX "Record_ownerUserId_idx" ON "Record"("ownerUserId");
CREATE INDEX "Record_createdAt_idx" ON "Record"("createdAt");
CREATE INDEX "Record_caseId_idx" ON "Record"("caseId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Case_ownerUserId_createdAt_idx" ON "Case"("ownerUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Case_ownerUserId_name_key" ON "Case"("ownerUserId", "name");

-- CreateIndex
CREATE INDEX "Tag_ownerUserId_idx" ON "Tag"("ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_ownerUserId_name_key" ON "Tag"("ownerUserId", "name");

-- CreateIndex
CREATE INDEX "RecordTag_recordId_idx" ON "RecordTag"("recordId");

-- CreateIndex
CREATE INDEX "RecordTag_tagId_idx" ON "RecordTag"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "RecordTag_recordId_tagId_key" ON "RecordTag"("recordId", "tagId");
