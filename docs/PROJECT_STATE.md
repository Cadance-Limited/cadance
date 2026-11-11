# Cadence — Project State & Engineering Handover Record

**Last Updated**: 2026-11-12  
**Repository**: `https://github.com/Cadance-Limited/cadance`  
**Canonical Package Manager**: Bun (`bun.lock`) with Node.js `v20` test runner compatibility (`npm test` / `bun test`).

---

## 1. Current Engineering State

Cadence is a single-route Next.js 16 (App Router) technical preview application providing two interactive operational analysis capabilities:
1. **Diagnostic Chat (`POST /api/chat`)**: Analyzes operational bottleneck descriptions and returns structured Markdown (`## Reasoning`, `## Prescription`, `## Open question`) separating supplied user evidence from assumptions.
2. **Document Intelligence (`POST /api/analyze`)**: Accepts pasted document text or a public HTTP/HTTPS URL, extracts structured fields, verifies invoice arithmetic (`Subtotal + Tax == Total`), flags anomalies (`high` | `medium` | `low`), and suggests ranked next moves.
3. **Waitlist & Scale Cohort Registration (`POST /api/subscribe`, `GET /api/subscribe`)**: Captures validated work emails into Prisma (`Waitlist` table) and returns verified registration counts.

---

## 2. Resolved P0 & P1 Issues (Stabilization Milestone)

| ID | Severity | Defect Summary | Resolution & Verification Evidence |
| :--- | :--- | :--- | :--- |
| **P0-1** | Critical | `bun install --frozen-lockfile` failed in GitHub Actions with `No version matching "^1.2.5" found for specifier "@radix-ui/react-select"`. | Reconciled `package.json` (`"@radix-ui/react-select": "^2.2.5"`, `"name": "nextjs_tailwind_shadcn_ts"`) with `bun.lock`. Added automated lockfile parity assertion in `tests/contracts.test.mjs`. |
| **P0-2** | Critical | `.gitignore` contained `.env*` without `!.env.example`, causing `git add .` to silently ignore `.env.example`, while `.zscripts/dev.pid` and `package-lock.json` were tracked. | Added `!.env.example`, `.test-build/`, `.zscripts/dev.pid`, `*.pid`, and `package-lock.json` to `.gitignore` and removed `.zscripts/dev.pid`. |
| **P1-1** | High | **DNS Rebinding TOCTOU Gap**: `src/lib/security.ts` validated DNS records before calling global `fetch()`, leaving a time-of-check/time-of-use window where `fetch()` performed an independent second DNS lookup. | Implemented `defaultPinnedTransport` in `src/lib/security.ts` using Node's `http.request`/`https.request` with a custom `lookup` callback pinned to the validated `primaryRecord.address` and `servername: parsedUrl.hostname` for TLS SNI and certificate verification. |
| **P1-2** | High | **Rate Limiter Design Flaws**: `src/lib/rate-limit.ts` used fixed time buckets, collapsed all unproxied clients into a single static `"direct-client"` bucket when `TRUST_PROXY=false`, and fell back to in-memory storage with only a warning when Redis was unconfigured in production. | Implemented a weighted sliding-window algorithm across `(prevWindow, currWindow)` in both Redis and memory, added SHA-256 request-header fingerprinting (`client_<hash>`) when `TRUST_PROXY=false`, and enforced fail-closed (`allowed: false`) in production when `ALLOW_IN_MEMORY_RATE_LIMIT=false` and Redis is absent/unreachable. |
| **P1-3** | High | **Database Concurrency & Migration Safety**: SQLite lacked WAL mode and `busy_timeout` under concurrent requests; `package.json` previously used `--accept-data-loss`. | Added `ensureDatabaseReady()` in `src/lib/db.ts` configuring `PRAGMA journal_mode = WAL;` and `PRAGMA busy_timeout = 5000;`, created versioned migrations in `prisma/migrations/20261111000000_init/migration.sql`, and documented the single-node SQLite vs. multi-instance PostgreSQL architecture. |
| **P2-1** | Medium | **Test Runner Portability**: `tests/` previously relied on `/usr/share/nodejs/@babel/parser` for AST checks and left `.test-build/` behind if interrupted. | Updated `tests/contracts.test.mjs` and `tests/test-helper.mjs` to prefer the project's declared `typescript` compiler API (`require("typescript")`) with fallback to `@babel/parser`, and registered a `process.on("exit")` hook to clean up `.test-build/` automatically. |

---

## 3. What Remains Planned (Not Yet Implemented)

The following items are intentionally scoped as future product roadmap features and are labeled as such across the UI and documentation:
- Direct binary document uploads (`PDF`, `DOCX`, `XLSX`)
- Native OAuth integrations with QuickBooks, NetSuite, DocuSign, and Slack
- User authentication, multi-tenant workspaces, SSO (`SAML`/`OIDC`), and SCIM provisioning
- Formal third-party SOC 2 Type II audit attestation
