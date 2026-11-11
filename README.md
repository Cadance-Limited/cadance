# Cadence — The AI Operations Analyst

Cadence is a production-grade SaaS application and interactive AI operations analyst built with **Next.js 16 (App Router)**, **React 19**, **Tailwind CSS v4**, **shadcn/ui**, **Framer Motion**, and **Prisma (SQLite)**.

It diagnoses operational bottlenecks from business workflows, invoices, contracts, and SOPs, then prescribes ranked next moves with estimated hours recovered.

## Key Capabilities

- **Live Diagnostic Chat (`/api/chat`)**: Reasons through AP cycle times, vendor invoice spikes, contract review bottlenecks, and approval workflows using a structured `Reasoning → Prescription → Open question` trace. Includes automatic deterministic fallback when run offline or without external model credentials.
- **Document Intelligence (`/api/analyze`)**: Ingests pasted invoices, contracts, SOPs, or external URLs (hardened with SSRF protection), extracts key fields, flags anomalies by severity (`high`, `medium`, `low`), and prescribes concrete next steps.
- **Interactive Ops Maturity Check**: 3-question diagnostic quiz scoring operations across Optimized, Maturing, Strained, and Critical bands with shareable results.
- **Keyboard-Driven UX**: Global command palette (`⌘K` / `Ctrl+K`), keyboard shortcuts overlay (`?`), demo tab navigation (`←` / `→`), inline plain-English glossary popovers, and searchable glossary index.
- **Waitlist & Scale Sales Capture (`/api/subscribe`)**: Prisma SQLite persistence with real-time waitlist counter synchronization, sliding-window rate limiting, and read-only serverless fallback storage.

## Getting Started

1. **Install dependencies**
   ```bash
   bun install
   # or: npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   bun run db:push
   ```

3. **Run development server**
   ```bash
   bun run dev
   ```
   Open `http://localhost:3000`.

4. **Typecheck, lint & production build**
   ```bash
   bun run typecheck
   bun run lint
   bun run build
   ```
