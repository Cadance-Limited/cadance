# Cadence — System Architecture

## 1. High-Level Architecture

Cadence is a Next.js 16 (App Router) full-stack TypeScript application. Both the interactive frontend and the JSON API endpoints are served from a unified Node.js runtime (`export const runtime = "nodejs"`).

```text
Browser Client (React 19 + Tailwind v4 + Framer Motion)
  │
  ├─► GET  /                        → SSR/Client Landing & Interactive Application (src/app/page.tsx)
  ├─► POST /api/chat                → Diagnostic Analyst Endpoint (src/app/api/chat/route.ts)
  ├─► POST /api/analyze             → Document Intelligence Endpoint (src/app/api/analyze/route.ts)
  ├─► GET/POST /api/subscribe       → Waitlist Persistence Endpoint (src/app/api/subscribe/route.ts)
  └─► GET/HEAD /api                 → Health & Database Readiness Endpoint (src/app/api/route.ts)
```

---

## 2. Security & Outbound Fetching Architecture (`src/lib/security.ts`)

Because `/api/analyze` accepts user-supplied URLs to fetch public vendor agreements or SOPs, outbound HTTP fetching is a critical trust boundary:

1. **Structural Validation (`validateExternalUrl`)**:
   - Permits only `http:` and `https:` protocols on standard ports (`80` and `443`).
   - Rejects embedded credentials (`user:pass@host`), control characters, single-label internal hostnames, internal TLDs (`.local`, `.internal`, `.localhost`, `.lan`, `.home`, `.corp`), and non-standard numeric IP encodings (octal `0177.0.0.1`, hex `0x7f000001`, integer `2130706433`).
2. **Comprehensive IP Blocklist (`isReservedOrPrivateIp`)**:
   - Blocks IPv4 loopback (`127.0.0.0/8`), unspecified (`0.0.0.0/8`), RFC1918 private (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), link-local / cloud metadata (`169.254.0.0/16`), CGNAT (`100.64.0.0/10`), benchmarking (`198.18.0.0/15`), TEST-NETs, and multicast/reserved (`>= 224.0.0.0`).
   - Blocks IPv6 loopback (`::1`), unspecified (`::`), unique local (`fc00::/7`), link-local (`fe80::/10`), multicast (`ff00::/8`), documentation (`2001:db8::/32`), 6to4/Teredo, and IPv4-mapped IPv6 addresses (`::ffff:127.0.0.1`, `::ffff:7f00:0001`).
3. **TOCTOU-Safe DNS Resolution & Socket Pinning (`resolveAndValidateHost` + `defaultPinnedTransport`)**:
   - Resolves all `A` and `AAAA` records via `dns.lookup(hostname, { all: true, verbatim: true })` and rejects the domain if **any** record resolves to a private or reserved address.
   - Instead of calling global `fetch()` (which would perform a second independent DNS lookup vulnerable to short-TTL DNS rebinding), `defaultPinnedTransport` invokes Node's `http.request` / `https.request` with a custom `lookup` callback that returns the exact validated `pinnedAddress` and `pinnedFamily`, while passing `servername: parsedUrl.hostname` for TLS SNI and certificate hostname verification.
4. **Redirect, Size & Content-Type Enforcement (`safeFetchExternalUrl`)**:
   - Redirects are never followed automatically; each `3xx` `Location` target is resolved and re-validated through `validateExternalUrl` and `resolveAndValidateHost` up to `maxRedirects: 3`.
   - Enforces an `8,000 ms` socket timeout, a `512 KB` streaming response cap, and an explicit `Content-Type` allowlist (`text/html`, `text/plain`, `application/xhtml+xml`, `application/xml`, `text/xml`, `text/markdown`).

---

## 3. Rate Limiting Architecture (`src/lib/rate-limit.ts`)

1. **Weighted Sliding-Window Algorithm**:
   - Tracks both the previous window (`prevCount`) and current window (`currCount`), computing:
     `effectiveCount = Math.floor(prevCount * ((windowMs - elapsedInCurrentWindow) / windowMs)) + currCount`
   - Prevents the `2x` boundary burst vulnerability inherent in fixed-window counters.
2. **Client Identification (`getClientIp`)**:
   - When `TRUST_PROXY="true"`, reads `cf-connecting-ip`, `x-vercel-forwarded-for`, `x-real-ip`, or `x-forwarded-for`.
   - When `TRUST_PROXY="false"`, ignores all spoofable IP forwarding headers and derives a deterministic SHA-256 fingerprint (`client_<16-hex>`) from `User-Agent`, `Accept-Language`, and `Sec-CH-UA` so distinct clients are isolated without trusting spoofed headers.
3. **Storage & Production Failure Policy**:
   - Uses Upstash Redis REST pipeline (`GET prevKey`, `INCR currKey`, `PEXPIRE currKey`) when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set.
   - If `NODE_ENV === "production"` and `ALLOW_IN_MEMORY_RATE_LIMIT === false`, missing or unreachable Redis fails closed (`allowed: false`, HTTP `429`) rather than silently degrading to per-process memory.

---

## 4. Database Architecture (`prisma/schema.prisma`, `src/lib/db.ts`)

- **Single-Instance / Local Target (Default)**:
  - Uses SQLite (`DATABASE_URL="file:./dev.db"`).
  - `ensureDatabaseReady()` configures `PRAGMA journal_mode = WAL;`, `PRAGMA busy_timeout = 5000;`, and `PRAGMA synchronous = NORMAL;` so concurrent requests on a single container/VM serialize cleanly without `SQLITE_BUSY` errors.
- **Multi-Instance / Serverless Target**:
  - Update `provider = "postgresql"` in `prisma/schema.prisma`, point `DATABASE_URL` to a managed PostgreSQL instance (with connection pooling such as PgBouncer), and run `bun run db:migrate:deploy`.
