## Status

- Prisma schema finalized
- SQLite dev DB working
- Seed script creates:
  - User
  - Record
  - Baseline RecordVersion (v1, isOriginal)
  - EditHistory entry
- Verified in Prisma Studio

Next step:
- Implement addVersion(recordId, content, actorUserId)