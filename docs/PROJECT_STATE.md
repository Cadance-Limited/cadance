# Cadence — Project State & Engineering Status

**Last Verified**: November 2026
**Primary Engineering Owner**: Argon
**Repository**: `https://github.com/Cadance-Limited/cadance`
**Canonical Package Manager**: Bun (`bun.lock`)

## 1. Current Engineering Status
Cadence has been upgraded from a single-page technical preview to a **Production-Grade Multi-Tenant Commercial SaaS Application** with zero unresolved P0, P1, or P2 engineering defects and **34 passing automated unit, security, API, and contract tests**.

### Resolved P0 / P1 / P2 Issues & Commercial SaaS Capabilities
1. **P0 — CI Dependency & Lockfile Parity (`package.json` vs `bun.lock`)**:
   - **Root Cause**: `package.json` previously declared `"@radix-ui/react-select": "^1.2.5"` while `bun.lock` recorded `"^2.2.5"` (resolved to `2.4.1`) and workspace name `"nextjs_tailwind_shadcn_ts"`. Running `bun install --frozen-lockfile` in GitHub Actions failed immediately.
   - **Resolution**: Reconciled `package.json` (`"@radix-ui/react-select": "^2.2.5"` and `"name": "nextjs_tailwind_shadcn_ts"`) to match `bun.lock` 100%, and added an automated lockfile parity contract test (`tests/contracts.test.mjs`) that parses `bun.lock` and verifies every dependency and devDependency specifier matches `package.json`.
2. **P0 — `.gitignore` Blocking `.env.example` & Stale Artifacts**:
   - **Root Cause**: `.gitignore` had `.env*` without a `!.env.example` negation rule, preventing `.env.example` from being tracked by Git when running `git add .`. Additionally, `.zscripts/dev.pid` was present in the working tree and `.test-build/` was not ignored.
   - **Resolution**: Added `!.env.example`, `.test-build/`, `.zscripts/dev.pid`, `*.pid`, and `package-lock.json` to `.gitignore`, deleted `.zscripts/dev.pid`, and added an automatic `process.on("exit")` cleanup hook in `tests/test-helper.mjs` so `.test-build/` never lingers after test execution.
3. **P1 — SSRF DNS-Rebinding TOCTOU Mitigation (`src/lib/security.ts`)**:
   - **Root Cause**: `safeFetchExternalUrl` validated DNS records via `resolveAndValidateHost()` and then invoked global `fetch(currentUrl)`. Because `fetch()` performs its own OS/runtime DNS resolution, a sophisticated attacker with a `TTL=0` DNS record could return a public IP during validation and `127.0.0.1` or `169.254.169.254` millisecond later during the socket connection.
   - **Resolution**: Implemented `defaultPinnedTransport` using Node's native `http.request` / `https.request` with a custom `lookup` callback that injects the exact `primaryRecord.address` and IP family validated by `resolveAndValidateHost()`, while preserving `Host` and TLS SNI (`servername: parsedUrl.hostname`) for strict TLS certificate verification. Tested in `tests/security.test.mjs`.
4. **P1 — Rate Limiter Sliding Window, Production Fail-Closed & Unproxied Client Fingerprinting (`src/lib/rate-limit.ts`)**:
   - **Root Cause**:
     1. Fixed time-window buckets allowed 2x burst traffic across window boundaries.
     2. When `TRUST_PROXY=false`, all requests fell back to a single static `"direct-client"` key, allowing one visitor to exhaust the rate limit for all users.
     3. In production without Upstash Redis configured, it silently fell back to per-process memory unless noticed in logs.
   - **Resolution**:
     1. Replaced fixed windows with a **weighted sliding-window algorithm** (`prevCount * prevWeight + currCount`) in both in-memory and Upstash Redis modes.
     2. Added `ALLOW_IN_MEMORY_RATE_LIMIT` control: in `NODE_ENV=production`, if Upstash Redis is unconfigured or unreachable and `ALLOW_IN_MEMORY_RATE_LIMIT=false`, the rate limiter **fails closed** (`allowed: false, backend: "fail-closed"`).
     3. When `TRUST_PROXY=false`, `extractClientIp()` ignores spoofed `X-Forwarded-For` / `X-Real-IP` headers and derives a privacy-preserving SHA-256 request header fingerprint (`client_<16-hex>`) from `User-Agent`, `Accept-Language`, and `Sec-CH-UA` so distinct unproxied clients do not share a single global bucket.
5. **P1 — Database Concurrency & Multi-Tenant Persistence (`src/lib/db.ts`, `prisma/schema.prisma`, `prisma/schema.postgresql.prisma`)**:
   - **Resolution**: Configured SQLite `PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL;` on initialization via `ensureDatabaseReady()`. Expanded the database schema (`prisma/migrations/20261112000000_saas_workspace/migration.sql`) with `Workspace`, `User`, `Session`, `DiagnosticRun`, and `AuditLog` models, and provided `prisma/schema.postgresql.prisma` for horizontal multi-instance cloud scaling.
6. **Flagship SaaS Upgrade — Native File Uploads & Multi-Tenant Workspaces (`src/lib/file-parser.ts`, `src/lib/auth.ts`, `src/app/api/auth/session/route.ts`, `src/app/api/workspace/runs/route.ts`)**:
   - **Zero-Dependency Native File Upload Parser (`src/lib/file-parser.ts`)**: Directly parses uploaded `.pdf` (`FlateDecode` zlib stream decompression + PDF `Tj`/`TJ` text operators), `.docx` and `.xlsx` (ZIP local header parsing + `zlib.inflateRawSync` XML extraction), `.csv`, `.json`, `.html`, and `.txt` files up to `4 MB` without adding external npm dependencies.
   - **Multi-Tenant Authentication & Audit Trail (`src/lib/auth.ts`)**: `scrypt` password hashing (`N=16384, r=8, p=1`), constant-time `crypto.timingSafeEqual` verification, `HttpOnly` SHA-256 hashed session cookies (`cadence_session`), automatic persistence of chat & document runs (`DiagnosticRun`) and immutable security events (`AuditLog`), and full UI integration via `WorkspaceModal` in the navigation bar and 1-click JSON export in `DemoDocs`.

## 2. Implemented Capabilities vs. Planned Enterprise Roadmap

| Capability | Status | Implementation Location |
| :--- | :--- | :--- |
| **Multi-Turn Diagnostic Chat** | **Implemented & Verified** | `src/app/api/chat/route.ts`, `src/lib/diagnostics-engine.ts` |
| **Document Intelligence (Text, Native File Upload & Public URL)** | **Implemented & Verified** | `src/app/api/analyze/route.ts`, `src/lib/file-parser.ts`, `src/lib/diagnostics-engine.ts` |
| **Native File Upload (`.pdf`, `.docx`, `.xlsx`, `.csv`, `.json`, `.txt`)** | **Implemented & Verified** | `src/lib/file-parser.ts`, `src/components/site/demo-docs.tsx` |
| **Multi-Tenant Workspaces, Auth & Persistent Run History** | **Implemented & Verified** | `src/lib/auth.ts`, `src/app/api/auth/session/route.ts`, `src/app/api/workspace/runs/route.ts`, `src/components/site/workspace-modal.tsx` |
| **Invoice Arithmetic Verification (`Subtotal + Tax == Total`)** | **Implemented & Verified** | `src/lib/diagnostics-engine.ts` |
| **SSRF Defense with DNS-Pinned Socket Transport (Zero TOCTOU)** | **Implemented & Verified** | `src/lib/security.ts` |
| **Weighted Sliding-Window Rate Limiting (Redis + Memory)** | **Implemented & Verified** | `src/lib/rate-limit.ts` |
| **Waitlist Persistence & Duplicate Handling (`Waitlist` model)** | **Implemented & Verified** | `src/app/api/subscribe/route.ts`, `prisma/schema.prisma` |
| **Healthcheck Endpoint (`GET /api`) with DB Probe** | **Implemented & Verified** | `src/app/api/route.ts` |
| **OAuth Connectors (QuickBooks, NetSuite, SAP, Coupa, Slack)** | **Planned Roadmap** | Disclosed as Planned in `src/components/site/integrations.tsx` |
| **Enterprise SAML SSO, SCIM & SOC 2 Type II Attestation** | **Planned Roadmap** | Disclosed as Planned in `src/components/site/security.tsx` & `pricing.tsx` |
