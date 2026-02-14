HANDOFF.md — record-app
Project Summary

Node.js + TypeScript + Express API for versioned records using Prisma (SQLite via libsql).
Supports creating records, versioning content, restoring versions, and listing history.
A Vite + React frontend is planned next but not started yet.

Tech Stack

Node.js (>=18)

TypeScript

Express

Prisma + SQLite (file:dev.db)

libsql adapter

Dev tools: tsx, concurrently, wait-on

Current State (✅ Verified Working)
Backend

Server runs on http://localhost:3001

Prisma schema is stable and must not be changed

smoke:all script reliably starts server + runs smoke tests

Routes (confirmed via /__routes)
GET    /__routes
POST   /records
GET    /records
GET    /records/:recordId
POST   /records/:recordId/versions
GET    /records/:recordId/versions
POST   /records/:recordId/restore

Record behavior

Records always expose currentVersion

Versions are immutable

Restoring a version creates a new version

No Prisma internals are leaked in API responses

All ChangeType usage comes from @prisma/client enums (no strings)

Important Files
src/
  server.ts                # Express app, mounts routes, serves /__routes
  routes/
    record.ts              # All record-related routes
  services/
    recordService.ts       # Core business logic (create, addVersion, restore)
  smoke.ts                 # End-to-end smoke test
prisma/
  schema.prisma            # DO NOT MODIFY
client/                    # (planned) Vite + React frontend (not created yet)

Dev Scripts
"dev": "tsx watch src/server.ts",
"dev:server": "tsx src/server.ts",
"smoke": "tsx src/smoke.ts",
"smoke:all": "concurrently -k \"npm run dev:server\" \"npx wait-on http://localhost:3001/__routes && npm run smoke\""


Run this to verify everything still works:

npm run smoke:all

Known Good Test User
ownerUserId / actorUserId:
cmllijj4m0000k4gpi37dxe9v

Where Work Stopped

Backend is stable and tested

smoke:all passes

Decision made to build Option A: Frontend

Chosen stack: Vite + React

Frontend not yet scaffolded

Next Intended Step

Build a Vite + React frontend under /client that:

Lists records by ownerUserId

Shows current version

Shows version history

Allows editing (new version)

Allows restoring a version

(Cursor prompt already prepared in prior session.)

Non-Goals (for now)

No authentication yet

No pagination

No deployment

No schema changes

Notes

Windows environment (PowerShell)

libsql URL is file:dev.db

/__routes is the authoritative truth for route registration

If you want, when you come back you can literally say:

“Resume from HANDOFF.md”

…and we’ll pick up exactly from here.