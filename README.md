# Cadence — The AI Operations Analyst

Cadence is an interactive operations diagnostic application built with **Next.js 16 (App Router)**, **React 19**, **TypeScript**, **Tailwind CSS v4**, **shadcn/ui**, **Framer Motion**, and **Prisma**.

It inspects operational questions and unstructured business documents (invoices, contracts, and Standard Operating Procedures), extracts key fields, flags anomalies (such as invoice arithmetic mismatches, undeclared surcharges, missing Purchase Order references, and Net-terms modifications), and outlines ranked next moves.

---

## Current Project Status & Scope

This repository is a hardened **technical preview and interactive product application**:

- **Live in this repository today**:
  - **Diagnostic Chat (`POST /api/chat`)**: Structured operational analysis (`Reasoning → Prescription → Open question`) with explicit separation of supplied user facts vs. assumptions, bounded retries with exponential backoff, and an automatic deterministic fallback engine when an external AI provider is not configured.
  - **Document Intelligence (`POST /api/analyze`)**: Extracts structured fields, severity-ranked anomalies (`high` | `medium` | `low`), and prescriptions from pasted text or public HTTP/HTTPS URLs. Includes programmatic invoice `Subtotal + Tax == Total` verification and explicit mode attribution (`live_ai` vs. `deterministic_fallback`).
  - **SSRF-Hardened URL Fetcher (`src/lib/security.ts`)**: Enforces `http:`/`https:` schemes on ports `80`/`443`, rejects embedded credentials, resolves DNS `A`/`AAAA` records to block loopback, RFC1918 private networks, link-local/cloud metadata (`169.254.169.254`), and IPv4-mapped IPv6 addresses, validates redirects hop-by-hop (`maxRedirects: 3`), restricts `Content-Type`, and caps response streams at `512 KB`.
  - **Waitlist & Scale Interest Capture (`POST /api/subscribe`, `GET /api/subscribe`)**: Validated email registration stored via Prisma (`Waitlist` model) with versioned SQL migrations (`prisma/migrations/`). Returns honest `503 Service Unavailable` errors if storage is unreachable and never inflates registration counts with hardcoded baselines.
  - **Application Security & Observability**: Sliding-window rate limiting (`src/lib/rate-limit.ts`) with optional Upstash Redis REST distributed backend, trusted-proxy IP verification (`TRUST_PROXY`), Content-Security-Policy (CSP) and HSTS headers (`next.config.ts`), and correlation-ID structured JSON logging (`src/lib/logger.ts`) with automatic PII and document-content redaction.
- **Planned on the Roadmap (Not yet implemented)**:
  - Direct binary file uploads (`PDF`, `DOCX`, `XLSX`)
  - Native OAuth integrations with QuickBooks, NetSuite, DocuSign, and Slack
  - User authentication, SSO (`SAML`/`OIDC`), SCIM provisioning, and multi-tenant RBAC workspaces
  - Formal third-party SOC 2 Type II attestation

---

## Architecture Overview

```text
cadence/
├── .github/workflows/ci.yml      # Automated CI pipeline (install, migrate, typecheck, lint, test, build)
├── prisma/
│   ├── schema.prisma             # Waitlist model definition
│   └── migrations/               # Version-controlled SQL migrations
├── public/
│   ├── logo.svg                  # Cadence pulse mark vector icon
│   └── robots.txt                # Static crawler directives
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── route.ts          # GET/HEAD health & database readiness check
│   │   │   ├── chat/route.ts     # POST diagnostic chat endpoint
│   │   │   ├── analyze/route.ts  # POST document intelligence endpoint
│   │   │   └── subscribe/route.ts# GET/POST waitlist persistence endpoint
│   │   ├── globals.css           # Tailwind v4 design tokens, utilities & reduced-motion rules
│   │   ├── layout.tsx            # Root layout, fonts, theme provider & canonical metadata
│   │   ├── page.tsx              # Single-route landing & interactive application page
│   │   ├── robots.ts             # Dynamic robots metadata route
│   │   └── sitemap.ts            # Dynamic sitemap metadata route
│   ├── components/
│   │   ├── site/                 # Application sections, interactive demos, modals & navigation
│   │   └── ui/                   # Reusable Radix / shadcn UI primitives
│   ├── hooks/                    # Client hooks (count-up, mobile detection, toast, waitlist count)
│   └── lib/
│       ├── db.ts                 # Prisma client singleton
│       ├── diagnostics-engine.ts # Deterministic fallback engine & LLM output schema normalizer
│       ├── env.ts                # Centralized environment variable validation
│       ├── logger.ts             # Structured JSON logger with PII/document redaction
│       ├── prompt-bus.ts         # Cross-component event bus for demo tabs, prompts & counts
│       ├── rate-limit.ts         # Distributed (Upstash Redis) & sliding-window rate limiter
│       ├── security.ts           # SSRF URL/DNS validator, safe HTTP fetcher & input sanitizer
│       ├── utils.ts              # Class-name merge helper
│       └── zai.ts                # AI SDK client singleton with timeout & exponential backoff
└── tests/                        # Automated unit, SSRF, API contract & frontend verification tests
```

---

## Prerequisites & Local Development Setup

### 1. Prerequisites
- **Node.js** `v18.18+` or `v20+` (for running Next.js and the built-in Node test runner)
- **Bun** `v1.2+` or **npm** `v9+`

### 2. Install Dependencies
```bash
bun install
# or with npm:
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
By default, `.env.example` configures a local SQLite database at `file:./dev.db`.

### 4. Initialize the Database
Generate the Prisma client and apply the version-controlled migrations:
```bash
npx prisma generate
npx prisma migrate deploy
```

### 5. Run the Development Server
```bash
npm run dev
# or:
bun run dev
```
Open [http://localhost:3000](http://localhost:3000).

---

## Testing & Verification

Run the automated test suite (covering SSRF protection, DNS validation, IP encodings, rate limiting, deterministic document extraction, arithmetic checks, prompt-injection sanitization, and frontend honesty/accessibility contracts):

```bash
npm test
```

Run static analysis and production build checks:

```bash
npm run typecheck
npm run lint
npm run build
```

---

## Production Deployment Considerations

1. **Database Persistence**:
   - SQLite (`file:./dev.db`) is suitable only for local development or single-node persistent-disk deployments.
   - For multi-instance or serverless deployments (e.g., Vercel, AWS ECS, Cloud Run), switch the Prisma `datasource db` provider in `prisma/schema.prisma` to `postgresql` and configure a managed PostgreSQL `DATABASE_URL`.
   - Always run `npx prisma migrate deploy` during release pipelines rather than `prisma db push --accept-data-loss`.
2. **Distributed Rate Limiting & Proxy Trust**:
   - Configure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` so rate limits are shared atomically across all instances.
   - Set `TRUST_PROXY="true"` only when running behind a reverse proxy (Cloudflare, Vercel, ALB, Caddy) that strips untrusted client-supplied forwarding headers.
3. **AI Provider Configuration**:
   - When `z-ai-web-dev-sdk` credentials are configured, `/api/chat` and `/api/analyze` return `mode: "live_ai"`.
   - If the external provider is unconfigured or unreachable, both endpoints gracefully fall back to `src/lib/diagnostics-engine.ts` and return `mode: "deterministic_fallback"` with a visible UI badge.
