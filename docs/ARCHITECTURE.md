# Cadence — Architecture & Security Reference

## 1. System Overview

Cadence is a Next.js 16 (App Router) and TypeScript application that provides operational diagnostics and document extraction with a deterministic non-hallucinating fallback engine and multi-tenant workspace persistence.

```
Browser Client (React 19 + Tailwind v4 + Radix UI)
  ├── Diagnostic Chat UI (src/components/site/demo-chat.tsx)
  │     └── POST /api/chat ──► Streaming Body Limit (64 KB) ──► Rate Limiter ──► Sanitizer ──► Z-AI / Deterministic Engine
  ├── Document Intelligence UI (src/components/site/demo-docs.tsx)
  │     └── POST /api/analyze ──► Streaming Body Limit (6 MB) ──► Rate Limiter ──►
  │           ├── File Upload Mode: Hardened Parser (.pdf, .docx, .xlsx, .csv, .json, .txt; zip/PDF bomb caps)
  │           ├── URL Mode: DNS-Pinned SSRF Fetcher (src/lib/security.ts -> defaultPinnedTransport)
  │           └── Text Mode: Sanitizer ──► Z-AI / Deterministic Engine (Invoice Math Verification)
  ├── Workspace & RBAC Modal (src/components/site/workspace-modal.tsx)
  │     ├── GET/POST/PATCH/DELETE /api/auth/session (Transactional Registration, scrypt, Session Rotation/Revocation)
  │     ├── GET/DELETE /api/workspace/runs (RBAC-enforced Run History & Audit Logs)
  │     └── GET/POST/PATCH/DELETE /api/workspace/members (RBAC Member Management: OWNER, ADMIN, MEMBER, VIEWER)
  └── Waitlist & Health
        ├── GET & POST /api/subscribe ──► Prisma Waitlist Model
        └── GET /api ──► Prisma SELECT 1 Healthcheck
```

## 2. Core Security Controls

### 2.1 Decompression Bomb & Malicious Archive Defense (`src/lib/file-parser.ts`)
`parseUploadedDocument` extracts text using Node's built-in `node:zlib` with strict resource bounds:
- **Raw Upload Cap**: `MAX_UPLOAD_BYTES = 4 MB`.
- **Per-Stream / Per-Entry Cap**: `MAX_SINGLE_ENTRY_UNCOMPRESSED_BYTES = 2 MB` passed directly to `zlib.inflateSync` / `zlib.inflateRawSync({ maxOutputLength })` so decompression aborts inside native C++ zlib before allocating oversized buffers.
- **Compression Ratio Cap**: `MAX_COMPRESSION_RATIO = 50` (any PDF stream or ZIP entry expanding beyond `50:1` is rejected with `413`).
- **Cumulative Output & Entry Caps**: `MAX_TOTAL_UNCOMPRESSED_BYTES = 4 MB`, `MAX_ARCHIVE_ENTRIES = 64`, and `MAX_PDF_STREAMS = 64`.
- **Path Traversal & Encryption Rejection**: Rejects ZIP entry names containing `..`, leading `/` or `\`, Windows drive letters, or null bytes (`400`), and rejects encrypted (`flags & 0x01`), streaming unknown-size (`flags & 0x08` with `compressedSize === 0`), or ZIP64 entries.

### 2.2 Streaming Request Body Enforcement (`src/lib/security.ts`)
All mutating API routes (`/api/chat`, `/api/analyze`, `/api/subscribe`, `/api/auth/session`, `/api/workspace/runs`, `/api/workspace/members`) read request bodies via `readBoundedJsonBody(req, maxBytes)`:
- Inspects `Content-Length` upfront when present.
- Reads `req.body.getReader()` chunk-by-chunk, accumulating `totalBytes`.
- Immediately cancels the stream and returns `413 PAYLOAD_TOO_LARGE` the moment cumulative bytes exceed `maxBytes`, even when `Content-Length` is omitted or spoofed.

### 2.3 Trusted Client Identification & Sliding-Window Rate Limiting (`src/lib/rate-limit.ts`)
- **No Rotatable Header Fingerprinting**: `getClientIp()` never hashes `User-Agent`, `Accept-Language`, or `Sec-CH-UA` headers (which an attacker can rotate per request).
- **When `TRUST_PROXY=false` (Default)**: Ignores all forwarding headers (`X-Forwarded-For`, `X-Real-IP`, `CF-Connecting-IP`) and maps unauthenticated traffic to `"unproxied-local"`, or `principal:<id>` when scoped to an account/session.
- **When `TRUST_PROXY=true`**: Extracts the verified IP from `TRUSTED_IP_HEADER` (if set), `CF-Connecting-IP`, `X-Vercel-Forwarded-For`, `X-Real-IP`, or `X-Forwarded-For` evaluated **right-to-left** using `TRUSTED_PROXY_HOPS` (default `1`) so clients cannot spoof the leftmost `X-Forwarded-For` entry.
- **Weighted Sliding Window & Fail-Closed Production Policy**: Prevents 2x boundary bursts across `(prevWindow, currWindow)` and fails closed (`allowed: false`) in `NODE_ENV=production` when `ALLOW_IN_MEMORY_RATE_LIMIT=false` and Upstash Redis is absent or unreachable.

### 2.4 Transactional Auth Lifecycle & Workspace RBAC (`src/lib/auth.ts`, `src/app/api/auth/session/route.ts`, `src/app/api/workspace/`)
- **Atomic Registration**: `POST /api/auth/session` (`action: "register"`) executes `workspace.create`, `user.create`, `workspaceMember.create` (`role: "OWNER"`), `session.create`, and `auditLog.create` inside `db.$transaction(...)` so partial failures roll back cleanly without orphaned workspaces.
- **Timing-Safe Login & Per-Account Lockout**: Login enforces a per-account rate limit (`8` attempts per `15` minutes on `principalId: email`) and runs `verifyPasswordAgainstDummy(password)` when an email is not found so response timing is invariant.
- **Session Rotation & Revocation**: `PATCH /api/auth/session` rotates the user's password and revokes all other active sessions (`revokeAllUserSessions(userId, currentSessionId)`); `DELETE /api/auth/session?scope=all` revokes all active sessions across devices.
- **Role-Based Access Control (RBAC)**: Backed by `WorkspaceMember` (`@@unique([workspaceId, userId])`) with 4 roles:
  - `VIEWER`: `runs:read`, `members:read`
  - `MEMBER`: `runs:read`, `runs:write`, `members:read`
  - `ADMIN`: `runs:read`, `runs:write`, `runs:delete`, `audit:read`, `members:read`, `members:manage`
  - `OWNER`: all permissions including `workspace:manage` and sole-owner demotion/removal protection (`LAST_OWNER_PROTECTED`).
