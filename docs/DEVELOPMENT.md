# Cadence — Developer Setup, Testing & Operations Guide

## 1. Local Development Setup

### Prerequisites
- **Bun** `v1.2+` (canonical package manager for `bun.lock`)
- **Node.js** `v18.18+` or `v20+` (used by Next.js and the built-in `node --test` runner)

### Step-by-Step Setup
```bash
# 1. Install dependencies using the frozen lockfile
bun install --frozen-lockfile

# 2. Create local environment configuration
cp .env.example .env

# 3. Generate Prisma Client and apply version-controlled SQL migrations
bun run db:generate
bun run db:migrate:deploy

# 4. Start the local development server on http://localhost:3000
bun run dev
```
*(On Windows PowerShell without Bun installed, `npm install`, `npx prisma generate`, `npx prisma migrate deploy`, and `npm run dev` are also fully supported).*

---

## 2. Verification & Validation Commands

Run all checks locally before opening or merging a Pull Request:

```bash
# 1. TypeScript strict typecheck
bun run typecheck

# 2. ESLint static analysis
bun run lint

# 3. Automated unit, SSRF, TOCTOU, API integration & lockfile/AST contract tests
npm test

# 4. Production Next.js build
bun run build
```

---

## 3. Database Operations, Backup & Recovery

### Creating a New Schema Migration (Development)
Never use `prisma db push --accept-data-loss` in shared or production environments. When modifying `prisma/schema.prisma`:
```bash
bun run db:migrate --name <descriptive_migration_name>
```
Commit the generated SQL file under `prisma/migrations/` to version control.

### Applying Migrations in CI / Production
```bash
bun run db:migrate:deploy
```

### Backing Up & Restoring Local / Single-Node SQLite
When running with SQLite (`DATABASE_URL="file:./dev.db"` in WAL mode):
- **Online Backup**: Use `sqlite3 prisma/dev.db ".backup 'prisma/dev.db.bak'"` to safely snapshot the database including WAL frames.
- **Restore**: Stop the application process, replace `prisma/dev.db` (and remove stale `-wal`/`-shm` files) with `dev.db.bak`, and restart the server.
- **Migrating to PostgreSQL for Multi-Instance Production**:
  1. Change `provider = "sqlite"` to `provider = "postgresql"` in `prisma/schema.prisma`.
  2. Set `DATABASE_URL="postgresql://user:pass@host:5432/cadence?schema=public"`.
  3. Run `bun run db:migrate:deploy`.
