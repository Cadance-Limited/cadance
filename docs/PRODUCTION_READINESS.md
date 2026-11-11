# Cadence — Production Readiness Assessment

**Assessment Date**: 2026-11-12  
**Target Scope**: Technical Preview & Single-Instance Production Deployment (Multi-Instance Ready with PostgreSQL + Upstash Redis)

---

## 1. Dimension Scorecard & Evidence

| Dimension | Status | Evidence & Implemented Controls | Known Limitations / Multi-Node Requirements |
| :--- | :--- | :--- | :--- |
| **Correctness** | **Ready** | All 28 frontend components and 4 API routes export and wire cleanly; `CommandPalette` (`⌘K`) synchronizes demo tabs and queued prompts; `GuidedTour` scroll recursion eliminated; invoice `Subtotal + Tax == Total` math verified programmatically. | Document intelligence currently accepts pasted text or public HTTP/HTTPS URLs; binary PDF/DOCX/XLSX parsing is planned. |
| **Type Safety & Build** | **Ready** | `tsconfig.json` enforces `strict: true` and `noImplicitAny: true`; `next.config.ts` sets `reactStrictMode: true` and `ignoreBuildErrors: false`; `package.json` specifiers match `bun.lock` 100%. | None. |
| **Security (SSRF & Headers)** | **Ready** | `src/lib/security.ts` enforces HTTP/HTTPS on ports 80/443, blocks all private/loopback/link-local/CGNAT/metadata IPv4 & IPv6 ranges (including `::ffff:` mapped and hex/octal/integer IPs), pins the resolved IP in `http`/`https` socket `lookup` (eliminating DNS rebinding TOCTOU), validates redirects hop-by-hop (`maxRedirects: 3`), and enforces CSP + HSTS headers. | Public demo processes submitted text transiently; users are advised not to paste regulated production secrets. |
| **Rate Limiting & Abuse** | **Ready** | `src/lib/rate-limit.ts` implements weighted sliding-window limits (`/api/chat`: 30/min, `/api/analyze`: 20/min, `/api/subscribe`: 15/min), ignores spoofed `X-Forwarded-For` when `TRUST_PROXY=false`, supports Upstash Redis REST pipelines, and fails closed in production when `ALLOW_IN_MEMORY_RATE_LIMIT=false`. | Multi-instance horizontal scaling requires setting `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. |
| **AI & Fallback Integrity** | **Ready** | Untrusted document inputs are sanitized and wrapped in `<untrusted_document>` XML boundaries; LLM outputs are normalized through `normalizeAnalysisPayload()`; deterministic fallback never invents hours recovered; UI badges `Live AI` vs. `Deterministic rule engine`. | Live AI mode requires valid `z-ai-web-dev-sdk` runtime credentials. |
| **Database & Migrations** | **Ready (Single-Node)** | Versioned SQL migration in `prisma/migrations/20261111000000_init/migration.sql`; SQLite `WAL` mode and `busy_timeout = 5000` configured in `src/lib/db.ts`; honest `503` errors on storage failure; zero fabricated baseline counts. | SQLite is a single-node file database; multi-instance cloud deployments must switch `prisma/schema.prisma` to `postgresql`. |
| **Testing & CI/CD** | **Ready** | 32 automated tests in `tests/*.test.mjs` covering SSRF, TOCTOU IP pinning, sliding-window rate limiting, API error contracts, lockfile parity, and AST/import validation; `.github/workflows/ci.yml` runs on push and PR. | Browser E2E tests (Playwright) can be added as multi-route authenticated workflows are introduced. |
| **Product Honesty** | **Ready** | Removed all fictional customer logos, fabricated testimonials, unverified pilot percentages, and premature `SOC 2 Type II achieved` claims; labeled ERP connectors and enterprise SSO/SOC 2 items as planned roadmap items. | None. |
