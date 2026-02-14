# Record App — Legal Evidence Management System

A full-stack application for collecting, organizing, and managing legal evidence with court-ready exhibit generation, chain of custody tracking, and file integrity verification.

Built as a portfolio project demonstrating full-stack development, security best practices, and domain-specific legal technology.

## Features

### Evidence Management
- **Versioned Records** — Every edit creates an immutable version. Full history preserved, any version can be restored.
- **File Attachments** — Upload files with automatic SHA-256 hashing for tamper detection.
- **Integrity Verification** — Re-hash any file on demand and compare against stored hash to prove evidence hasn't been altered.

### Court Preparation
- **Exhibit Designation** — Assign records as exhibits (A, B, C...) with automatic sequential numbering.
- **PDF Exhibit Packages** — Generate court-ready PDFs with cover sheet, record content, chain of custody log, and attachments summary.
- **Chain of Custody** — Every action (create, edit, view, download, share) is logged with actor, timestamp, IP address, and user agent.

### Organization
- **Cases** — Group records by legal case with case numbers and descriptions.
- **Tags** — Categorize evidence with colored tags (photo, document, testimony, etc.).
- **Search & Filter** — Full-text search, filter by case, tag, and status.

### Security
- **JWT Authentication** — Secure login with bcrypt password hashing.
- **Audit Logging** — IP address and user-agent captured on every action.
- **Share Links** — Generate time-limited, revocable links for external access.
- **Rate Limiting** — Protection against brute force attacks.
- **Security Headers** — Helmet.js for HTTP security headers.

### Dashboard
- **Analytics Overview** — Visual dashboard with activity timeline, records by case/tag charts, exhibit checklist, and recent activity feed.
- **Real-time Stats** — Record counts, attachment totals, case breakdowns.

## Tech Stack

- **Backend:** Node.js, TypeScript, Express
- **Database:** Prisma ORM, SQLite (dev) / PostgreSQL (prod)
- **Frontend:** React 19, Vite, Recharts
- **Auth:** JWT, bcrypt
- **Security:** Helmet, CORS, express-rate-limit
- **PDF:** PDFKit
- **Testing:** 40 end-to-end smoke tests

## Quick Start

```bash
# Clone and install
git clone https://github.com/YOUR_USERNAME/record-app.git
cd record-app
npm install
cd client && npm install && cd ..

# Setup environment
cp .env.example .env
# Edit .env with your JWT_SECRET

# Setup database
npx prisma migrate dev

# Run development
npm run dev:all
```

Open http://localhost:5173 to access the app.

## Testing

```bash
npm run smoke:all
```

Runs all 40 end-to-end smoke tests covering authentication, CRUD operations, versioning, exhibits, integrity verification, audit logging, cases, tags, dashboard, and security headers.

## Production Build

```bash
npm run build
npm start
```

## Docker

```bash
docker build -t record-app .
docker run -p 3001:3001 \
  -e JWT_SECRET=your-secret-here \
  -e DATABASE_URL=file:dev.db \
  record-app
```

## API Endpoints

### Auth (Public)
- `POST /auth/register` — Create account
- `POST /auth/login` — Login
- `GET /auth/me` — Current user info

### Records (Protected)
- `POST /records` — Create record
- `GET /records` — List records (with search, case, tag, status filters)
- `GET /records/:id` — Get record
- `POST /records/:id/versions` — Add version
- `POST /records/:id/restore` — Restore version
- `POST /records/:id/archive` — Archive
- `POST /records/:id/unarchive` — Unarchive

### Exhibits
- `POST /records/:id/exhibit` — Designate as exhibit
- `GET /exhibits` — List exhibits
- `GET /exhibits/:id/pdf` — Download exhibit PDF

### Cases & Tags
- `POST /cases` — Create case
- `GET /cases` — List cases
- `PATCH /cases/:id` — Update case
- `POST /records/:id/case` — Assign record to case
- `DELETE /records/:id/case` — Remove from case
- `POST /tags` — Create tag
- `GET /tags` — List tags
- `DELETE /tags/:id` — Delete tag
- `POST /records/:id/tags` — Add tag to record
- `DELETE /records/:id/tags/:tagId` — Remove tag

### Attachments
- `POST /records/:id/attachments` — Upload file
- `GET /attachments/:id/download` — Download file
- `GET /attachments/:id/verify` — Verify file integrity

### Share Links
- `POST /records/:id/shares` — Create share link
- `GET /share/:token` — View shared record (public)

### Dashboard
- `GET /dashboard` — Dashboard analytics

## Screenshots

[Add screenshots of: login page, dashboard, records view, exhibit PDF]

## Architecture Decisions

- **Immutable Versions:** Record content is never overwritten. Every edit creates a new version, preserving the complete history — critical for legal evidence.
- **SHA-256 File Hashing:** Every uploaded file is hashed at upload time. The verify endpoint re-computes the hash to detect tampering.
- **Audit Trail:** Every action logs the actor, timestamp, IP address, and user-agent. This data feeds into the exhibit PDF's chain of custody page.
- **Soft Deletes:** Attachments use `isActive` flag rather than hard deletes. Nothing is truly destroyed.
- **Single-Origin Deployment:** In production, Express serves both the API and the React frontend from the same origin, eliminating CORS complexity.

## License

MIT
