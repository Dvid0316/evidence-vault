-- CreateTable
CREATE TABLE "Exhibit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "exhibitCode" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Exhibit_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "Record" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Exhibit_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Exhibit_recordId_key" ON "Exhibit"("recordId");

-- CreateIndex
CREATE INDEX "Exhibit_ownerUserId_createdAt_idx" ON "Exhibit"("ownerUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Exhibit_ownerUserId_exhibitCode_key" ON "Exhibit"("ownerUserId", "exhibitCode");
