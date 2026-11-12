# Cadence — The AI Operations Analyst

Cadence is an AI operations analyst built for finance, procurement, and operations teams. It diagnoses operational bottlenecks from multi-turn conversations and business documents (invoices, vendor contracts, and Standard Operating Procedures), verifies invoice arithmetic programmatically, and persists workspace diagnostic runs and audit logs with Role-Based Access Control (RBAC).

---

## 1. Verified Capabilities vs. Planned Roadmap

| Capability | Status | Details |
| :--- | :--- | :--- |
| **Multi-Turn Diagnostic Chat (`/api/chat`)** | **Implemented** | Live LLM completions via `z-ai-web-dev-sdk` with bounded timeouts/retries and a non-hallucinating deterministic fallback engine (`src/lib/diagnostics-engine.ts`). |
| **Document Intelligence (`/api/analyze`)** | **Implemented** | Accepts pasted text, uploaded files (`.pdf`, `.docx`, `.xlsx`, `.csv`, `.json`, `.html`, `.txt` up to `4 MB`), or public HTTP/HTTPS URLs; verifies `Subtotal + Tax == Total`. |
| **Decompression Bomb & Stream Protection** | **Implemented** | `src/lib/file-parser.ts` enforces `maxOutputLength` (`2 MB`), `50:1` compression ratio caps, `4 MB` cumulative caps, and ZIP path-traversal rejection. `readBoundedJsonBody` enforces streaming body limits across all API routes. |
| **DNS-Pinned SSRF Defense (`src/lib/security.ts`)** | **Implemented** | Blocks private, loopback, link-local, CGNAT, and cloud metadata IPv4/IPv6 ranges and pins the HTTP/HTTPS socket directly to the DNS-validated IP (`defaultPinnedTransport`). |
| **Trusted Client Rate Limiting (`src/lib/rate-limit.ts`)** | **Implemented** | Weighted sliding-window limiter with right-to-left `X-Forwarded-For` hop resolution (`TRUSTED_PROXY_HOPS`), non-spoofable `"unproxied-local"` bucketing when `TRUST_PROXY=false`, and fail-closed production mode. |
| **Transactional Multi-Tenant Auth & RBAC** | **Implemented** | Atomic registration via `db.$transaction`, `scrypt` password hashing with constant-time dummy verification, per-account login lockout, session rotation/revocation, and `WorkspaceMember` RBAC (`OWNER`, `ADMIN`, `MEMBER`, `VIEWER`). |
| **OAuth ERP Connectors, SAML SSO/SCIM & SOC 2 Type II** | **Planned Roadmap** | Disclosed as planned roadmap items in the UI and documentation; not claimed as active in v0.2. |

---

## 2. Quickstart (Local Development)

### Prerequisites
- **Bun** `>= 1.2` (canonical lockfile: `bun.lock`) or **Node.js** `>= 20`

### Setup
```bash
# 1. Install dependencies using the canonical lockfile
bun install --frozen-lockfile

# 2. Copy environment configuration
cp .env.example .env

# 3. Generate Prisma client and apply versioned SQLite migrations
bun run db:generate
bun run db:migrate:deploy

# 4. Run typecheck, lint, and the 37-test automated suite
bun run typecheck
bun run lint
npm test

# 5. Start the development server on http://localhost:3000
bun run dev
```

---

## 3. Environment Variables (`.env.example`)

| Variable | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | **Yes (Prod)** | `file:./dev.db` (Dev) | Prisma database connection string (SQLite for single-node; PostgreSQL via `prisma/schema.postgresql.prisma` for multi-node). |
| `NEXT_PUBLIC_APP_URL` | No | `https://cadence.ai` | Canonical base URL for metadata, `robots.txt`, and `sitemap.xml`. |
| `TRUST_PROXY` | No | `false` | Set to `true` only when deployed behind a trusted reverse proxy that strips/overwrites forwarding headers. |
| `TRUSTED_PROXY_HOPS` | No | `1` | Number of trusted reverse-proxy hops from the right of `X-Forwarded-For` when `TRUST_PROXY=true`. |
| `TRUSTED_IP_HEADER` | No | *(unset)* | Optional explicit ingress header name (e.g. `cf-connecting-ip`) when `TRUST_PROXY=true`. |
| `UPSTASH_REDIS_REST_URL` | **Yes (Multi-node)** | *(unset)* | Upstash Redis REST endpoint for distributed sliding-window rate limiting. |
| `UPSTASH_REDIS_REST_TOKEN` | **Yes (Multi-node)** | *(unset)* | Upstash Redis REST bearer token. |
| `ALLOW_IN_MEMORY_RATE_LIMIT` | No | `false` in Prod | Must be explicitly set to `true` for single-node production deployments without Redis; otherwise rate limiting fails closed in production. |
| `LOG_LEVEL` | No | `info` | Structured JSON log level (`debug`, `info`, `warn`, `error`). |

---

## 4. Engineering Documentation (`docs/`)
- [`docs/PROJECT_STATE.md`](docs/PROJECT_STATE.md) — Current engineering state, resolved defect inventory, and roadmap boundaries.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — Security controls, streaming body enforcement, decompression limits, SSRF socket pinning, and RBAC model.
- [`docs/ENGINEERING_DECISIONS.md`](docs/ENGINEERING_DECISIONS.md) — Architecture Decision Records (`ADR-001` through `ADR-005`).
- [`docs/PRODUCTION_READINESS.md`](docs/PRODUCTION_READINESS.md) — Readiness scorecard and single-node vs. multi-node deployment requirements.
- [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) — Local workflow, schema validation, and database backup/restore runbook.
