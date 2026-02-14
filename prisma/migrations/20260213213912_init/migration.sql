-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Record" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "originalDeviceId" TEXT,
    "currentVersionId" TEXT,
    CONSTRAINT "Record_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "RecordVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Record_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecordVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "versionNumber" INTEGER NOT NULL,
    "isOriginal" BOOLEAN NOT NULL DEFAULT false,
    "contentText" TEXT NOT NULL,
    "eventDateText" TEXT,
    "editedByUserId" TEXT,
    CONSTRAINT "RecordVersion_editedByUserId_fkey" FOREIGN KEY ("editedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RecordVersion_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "Record" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordId" TEXT NOT NULL,
    "versionId" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fileType" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Attachment_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "Record" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Attachment_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "RecordVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EditHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordId" TEXT NOT NULL,
    "versionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changeType" TEXT NOT NULL,
    "changeSummary" TEXT NOT NULL,
    "actorUserId" TEXT,
    "systemGenerated" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "EditHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EditHistory_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "Record" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EditHistory_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "RecordVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LocationSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordId" TEXT NOT NULL,
    "versionId" TEXT,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "accuracyM" REAL,
    CONSTRAINT "LocationSnapshot_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "Record" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LocationSnapshot_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "RecordVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShareLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "revokedAt" DATETIME,
    "token" TEXT NOT NULL,
    CONSTRAINT "ShareLink_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "Record" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Record_currentVersionId_key" ON "Record"("currentVersionId");

-- CreateIndex
CREATE INDEX "Record_ownerUserId_idx" ON "Record"("ownerUserId");

-- CreateIndex
CREATE INDEX "Record_createdAt_idx" ON "Record"("createdAt");

-- CreateIndex
CREATE INDEX "RecordVersion_recordId_createdAt_idx" ON "RecordVersion"("recordId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecordVersion_recordId_versionNumber_key" ON "RecordVersion"("recordId", "versionNumber");

-- CreateIndex
CREATE INDEX "Attachment_recordId_uploadedAt_idx" ON "Attachment"("recordId", "uploadedAt");

-- CreateIndex
CREATE INDEX "Attachment_fileHash_idx" ON "Attachment"("fileHash");

-- CreateIndex
CREATE INDEX "EditHistory_recordId_createdAt_idx" ON "EditHistory"("recordId", "createdAt");

-- CreateIndex
CREATE INDEX "EditHistory_actorUserId_idx" ON "EditHistory"("actorUserId");

-- CreateIndex
CREATE INDEX "LocationSnapshot_recordId_capturedAt_idx" ON "LocationSnapshot"("recordId", "capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShareLink_token_key" ON "ShareLink"("token");

-- CreateIndex
CREATE INDEX "ShareLink_recordId_createdAt_idx" ON "ShareLink"("recordId", "createdAt");

-- CreateIndex
CREATE INDEX "ShareLink_expiresAt_idx" ON "ShareLink"("expiresAt");
