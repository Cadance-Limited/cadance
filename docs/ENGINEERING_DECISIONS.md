# Cadence — Engineering Decisions (ADR Log)

## ADR-001: Canonical Package Manager (`bun.lock`)
- **Context**: The repository contained `bun.lock` as well as references to npm scripts using Unix-only pipes (`2>&1 | tee dev.log`), and an accidental version mismatch on `@radix-ui/react-select` (`^1.2.5` vs `^2.2.5`).
- **Decision**: Standardize on **Bun** (`bun.lock`) as the canonical lockfile for CI (`bun install --frozen-lockfile`), ignore `package-lock.json` in `.gitignore`, remove Unix-only `tee` pipes from `package.json` scripts so both `bun run` and `npm run` work on Windows PowerShell and Linux, and enforce lockfile parity in `tests/contracts.test.mjs`.

## ADR-002: Eliminating DNS Rebinding TOCTOU via Socket-Level IP Pinning
- **Context**: Validating a domain's DNS records via `dns.lookup()` and subsequently passing the URL to global `fetch()` leaves a time-of-check/time-of-use (TOCTOU) window where a malicious DNS server with `TTL=0` can return a public IP on the first lookup and `127.0.0.1` or `169.254.169.254` when `fetch()` opens its socket. Furthermore, delegating URL fetching to `zai.functions.invoke("page_reader")` outsourced network egress to an unverified external service.
- **Decision**: Remove external `page_reader` delegation and implement `defaultPinnedTransport` in `src/lib/security.ts` using Node's native `http.request` / `https.request` with a custom `lookup` callback that directly supplies the validated `pinnedAddress` and `pinnedFamily` while preserving `servername: parsedUrl.hostname` for TLS SNI and certificate verification.

## ADR-003: Weighted Sliding-Window Rate Limiting & Non-Colliding Client Keys
- **Context**: Fixed time buckets allow up to `2x` the configured rate limit across window boundaries, and returning a static `"direct-client"` string when `TRUST_PROXY=false` placed all unproxied visitors into one shared bucket.
- **Decision**: Implement a weighted sliding-window counter across `(prevWindow, currWindow)` in both in-memory and Upstash Redis modes, compute a SHA-256 request-header fingerprint (`client_<16-hex>`) when `TRUST_PROXY=false`, and fail closed in production when `ALLOW_IN_MEMORY_RATE_LIMIT=false` and Redis is unavailable.

## ADR-004: Non-Hallucinating Deterministic Fallback & Explicit Mode Attribution
- **Context**: An AI operations analyst must remain testable in environments without live LLM credentials, but must never fabricate hours recovered (`~6.2 hrs/week`), historical baselines, or unverified industry statistics.
- **Decision**: `src/lib/diagnostics-engine.ts` performs deterministic regex/heuristic field extraction and programmatic invoice arithmetic checks (`Subtotal + Tax == Total`), sets `estHoursRecovered: null` unless explicitly present in the document, and returns `mode: "deterministic_fallback"` vs. `mode: "live_ai"` so both `DemoChat` and `DemoDocs` display an explicit mode badge.

## ADR-005: Honest Waitlist Persistence & Error Reporting
- **Context**: `/api/subscribe` previously added a hardcoded `BASE_WAITLIST_COUNT = 412` and silently fell back to an in-memory map on database errors, returning `200 OK` even when persistence failed.
- **Decision**: Remove `BASE_WAITLIST_COUNT = 412` and remove the in-memory waitlist fallback. `/api/subscribe` queries only Prisma (`db.waitlist`), initializes SQLite WAL concurrency pragmas (`ensureDatabaseReady()`), and returns HTTP `503 Service Unavailable` (`code: "DATABASE_UNAVAILABLE"`) if the database is unreachable.
