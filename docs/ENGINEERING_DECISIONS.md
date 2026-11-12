# Cadence — Engineering Decisions (ADRs)

## ADR-001: Canonical Package Manager & Lockfile Parity (`bun.lock`)
- **Context**: The repository contained a `bun.lock` lockfile alongside `.github/workflows/ci.yml` configured with `bun install --frozen-lockfile`, while `package.json` had drifted on `@radix-ui/react-select`.
- **Decision**: Standardize on `bun.lock` as the single committed lockfile, ignore `package-lock.json` in `.gitignore`, and enforce 100% dependency specifier parity between `package.json` and `bun.lock` via `tests/contracts.test.mjs`.

## ADR-002: Socket-Level DNS Pinning for Outbound URL Fetching
- **Context**: Validating DNS via `dns.lookup` before calling global `fetch(url)` leaves a Time-of-Check to Time-of-Use (TOCTOU) window for `TTL=0` DNS rebinding attacks.
- **Decision**: Implement `defaultPinnedTransport` using Node's `http.request` and `https.request` with a custom `lookup` callback that returns the exact IP address validated by `resolveAndValidateHost()`, while passing `servername: parsedUrl.hostname` for TLS SNI verification.

## ADR-003: Non-Spoofable Client Identification & Weighted Sliding-Window Rate Limiting
- **Context**: Hashing `User-Agent` and `Accept-Language` when `TRUST_PROXY=false` allowed attackers to bypass rate limits by rotating HTTP headers, while taking `X-Forwarded-For.split(",")[0]` when `TRUST_PROXY=true` allowed attackers to prepend spoofed IPs.
- **Decision**:
  1. Never use client-controlled `User-Agent`/`Accept-Language` headers for rate-limit bucketing.
  2. When `TRUST_PROXY=false`, map unauthenticated requests to `"unproxied-local"` (and authenticated or account-targeted requests to `principal:<id>`).
  3. When `TRUST_PROXY=true`, resolve `X-Forwarded-For` from right to left using `TRUSTED_PROXY_HOPS` (default `1`).

## ADR-004: Bounded Streaming Body & Archive Decompression Limits
- **Context**: Checking `req.headers.get("content-length")` before `await req.text()` fails when `Content-Length` is omitted or spoofed on chunked streams, and unbounded `zlib.inflateRawSync` is vulnerable to ZIP/PDF decompression bombs.
- **Decision**: Enforce streaming byte caps chunk-by-chunk via `readBoundedJsonBody` (`req.body.getReader()`) across all API routes, and enforce `maxOutputLength` (`2 MB`), cumulative uncompressed caps (`4 MB`), compression ratio limits (`50:1`), and path traversal rejection in `src/lib/file-parser.ts`.

## ADR-005: Transactional Multi-Tenant Auth & `WorkspaceMember` RBAC
- **Context**: Non-transactional workspace/user creation risked orphaned rows on partial failure, and flat `user.role` fields lacked multi-workspace membership and granular permission checks.
- **Decision**: Wrap workspace registration and member mutations in `db.$transaction(...)`, add the `WorkspaceMember` join table with `OWNER`, `ADMIN`, `MEMBER`, and `VIEWER` roles, enforce permissions across `/api/chat`, `/api/analyze`, `/api/workspace/runs`, and `/api/workspace/members`, and maintain 100% schema parity between `prisma/schema.prisma` (SQLite) and `prisma/schema.postgresql.prisma` (PostgreSQL).
