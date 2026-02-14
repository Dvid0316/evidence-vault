// Prisma schema (Postgres recommended)

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum RecordStatus {
  ACTIVE
  ARCHIVED
}

enum ChangeType {
  ADDED
  MODIFIED
  REMOVED
  SYSTEM
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  createdAt DateTime @default(now())

  records   Record[]
  versions  RecordVersion[] @relation("VersionEditor")
  history   EditHistory[]
}

model Record {
  id              String       @id @default(uuid())
  ownerUserId     String
  createdAt       DateTime     @default(now()) // immutable by policy
  status          RecordStatus @default(ACTIVE)

  // Device/source metadata captured at creation (immutable by policy)
  originalDeviceId String?

  // Pointer to current version for fast reads
  currentVersionId String?
  currentVersion   RecordVersion? @relation("CurrentVersion", fields: [currentVersionId], references: [id])

  owner           User          @relation(fields: [ownerUserId], references: [id])
  versions        RecordVersion[]
  attachments     Attachment[]
  history         EditHistory[]
  locationSnaps   LocationSnapshot[]
  shareLinks      ShareLink[]

  @@index([ownerUserId])
  @@index([createdAt])
}

model RecordVersion {
  id            String   @id @default(cuid())
  recordId      String
  createdAt     DateTime @default(now())

  // Monotonic per record. Enforce uniqueness per record.
  versionNumber Int

  // Baseline/original marker
  isOriginal    Boolean @default(false)

  // User content
  contentText   String
  // User-provided "event date" as text (never normalized automatically)
  eventDateText String?

  editedByUserId String?
  editedBy       User?   @relation("VersionEditor", fields: [editedByUserId], references: [id])

  record        Record  @relation(fields: [recordId], references: [id])

  // Optional: tie attachments and location snapshots to a specific version
  attachments   Attachment[]
  locationSnaps LocationSnapshot[]

  // Relation for Record.currentVersion pointer
  currentOf     Record? @relation("CurrentVersion")

  @@unique([recordId, versionNumber])
  @@index([recordId, createdAt])
}

model Attachment {
  id          String   @id @default(cuid())
  recordId    String
  versionId   String?

  uploadedAt  DateTime @default(now())

  fileType    String
  storagePath String

  // Immutable per upload (integrity)
  fileHash    String

  // For "current view" without deleting old ones
  isActive    Boolean  @default(true)

  record      Record        @relation(fields: [recordId], references: [id])
  version     RecordVersion? @relation(fields: [versionId], references: [id])

  @@index([recordId, uploadedAt])
  @@index([fileHash])
}

model EditHistory {
  id           String     @id @default(cuid())
  recordId     String
  versionId    String?

  createdAt    DateTime   @default(now())

  changeType   ChangeType
  changeSummary String

  actorUserId  String?
  actor        User?      @relation(fields: [actorUserId], references: [id])

  // Distinguish system migrations/sync fixes
  systemGenerated Boolean @default(false)

  record       Record        @relation(fields: [recordId], references: [id])
  version      RecordVersion? @relation(fields: [versionId], references: [id])

  @@index([recordId, createdAt])
  @@index([actorUserId])
}

model LocationSnapshot {
  id         String   @id @default(cuid())
  recordId   String
  versionId  String?

  capturedAt DateTime @default(now())

  // Device-reported location only (opt-in per record/version in UI)
  latitude   Float
  longitude  Float
  accuracyM  Float?

  record     Record        @relation(fields: [recordId], references: [id])
  version    RecordVersion? @relation(fields: [versionId], references: [id])

  @@index([recordId, capturedAt])
}

model ShareLink {
  id        String   @id @default(cuid())
  recordId  String

  createdAt DateTime @default(now())
  expiresAt DateTime?
  revokedAt DateTime?

  // Unguessable token for read-only access
  token     String   @unique

  record    Record   @relation(fields: [recordId], references: [id])

  @@index([recordId, createdAt])
  @@index([expiresAt])
}
