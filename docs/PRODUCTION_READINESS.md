# Cadence — Production Readiness Assessment

## 1. Readiness Summary

Cadence is ready for **single-node container/VPS production deployment** out of the box (using SQLite in WAL mode) and **multi-instance cloud deployment** when pointed at managed PostgreSQL (`prisma/schema.postgresql.prisma`) and Upstash Redis (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`).

| Dimension | Status | Verification Evidence |
| :--- | :--- | :--- |
| **Build & CI Reproducibility** | **Ready** | `package.json` and `bun.lock` have 100% specifier parity (`tests/contracts.test.mjs`). Both `prisma/schema.prisma` and `prisma/schema.postgresql.prisma` are validated in `.github/workflows/ci.yml`. |
| **Type Safety & Linting** | **Ready** | `next.config.ts` enforces `typescript.ignoreBuildErrors = false` and `reactStrictMode = true`. All `src/` files pass `tsc --noEmit` and `eslint`. |
| **SSRF & Outbound Network Security** | **Ready** | `src/lib/security.ts` blocks private/loopback/link-local/CGNAT/metadata IPv4 & IPv6, pins socket connections to the DNS-validated IP (`defaultPinnedTransport`), and caps responses at `512 KB`. |
| **Streaming Body & Archive Decompression Safety** | **Ready** | `readBoundedJsonBody` aborts oversized chunked streams mid-flight (`413`) even when `Content-Length` is spoofed. `src/lib/file-parser.ts` enforces `maxOutputLength` (`2 MB`), `50:1` compression ratio, `4 MB` cumulative cap, and path-traversal rejection. |
| **Rate Limiting & Client Identification** | **Ready** | `src/lib/rate-limit.ts` uses weighted sliding windows, right-to-left `X-Forwarded-For` hop selection (`TRUSTED_PROXY_HOPS`) when `TRUST_PROXY=true`, non-spoofable `"unproxied-local"` bucketing when `TRUST_PROXY=false`, and fail-closed production enforcement. |
| **Transactional Auth & Workspace RBAC** | **Ready** | Registration is atomic via `db.$transaction`. Login uses per-account lockout (`8` per `15m`) and constant-time dummy `scrypt` verification. `WorkspaceMember` enforces `OWNER`, `ADMIN`, `MEMBER`, and `VIEWER` permissions. |
| **Product & Marketing Honesty** | **Ready** | Native file uploads (`.pdf`, `.docx`, `.xlsx`, `.csv`, `.json`, `.txt`) and multi-tenant workspaces with RBAC are implemented; third-party OAuth ERP connectors, SAML SSO/SCIM, and SOC 2 Type II certification remain clearly labeled as planned roadmap capabilities. |

## 2. Explicit Scope Boundaries & Operational Requirements
1. **Scanned / Image-Only PDFs (OCR)**: `src/lib/file-parser.ts` extracts text from digital text-stream PDFs (`FlateDecode` + `Tj`/`TJ`). Scanned image-only PDFs without embedded text streams return `422 Unprocessable Entity` with a clear message instructing the user to supply a text-based PDF or paste text.
2. **Multi-Instance Deployment Requirements**: Before scaling horizontally beyond 1 instance, operators must switch `prisma/schema.prisma` to `prisma/schema.postgresql.prisma`, set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, set `ALLOW_IN_MEMORY_RATE_LIMIT=false`, and configure `TRUST_PROXY=true` with the correct `TRUSTED_PROXY_HOPS` count for their load balancer.
