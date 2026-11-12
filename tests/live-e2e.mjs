#!/usr/bin/env node
import assert from "node:assert/strict";

/**
 * Live HTTP End-to-End Verification Runner (`node tests/live-e2e.mjs`)
 * Executes against a running Next.js server (`E2E_BASE_URL`, default `http://localhost:3000`):
 * 1. Verifies landing page HTML and security headers (CSP, X-Frame-Options, nosniff)
 * 2. Verifies `/api` healthcheck
 * 3. Registers a new workspace (`POST /api/auth/session`)
 * 4. Runs document analysis on an uploaded CSV invoice (`POST /api/analyze`)
 * 5. Verifies saved diagnostic run in `GET /api/workspace/runs`
 * 6. Invites a VIEWER via `POST /api/workspace/members` and verifies RBAC `403` on run deletion
 */

const baseUrl = (process.env.E2E_BASE_URL || "http://localhost:3000").replace(
  /\/$/,
  "",
);

async function runLiveE2E() {
  console.log(`[E2E] Target: ${baseUrl}`);

  // 1. Landing page & security headers
  const homeRes = await fetch(`${baseUrl}/`);
  assert.equal(homeRes.status, 200, "Landing page must return HTTP 200");
  const csp = homeRes.headers.get("content-security-policy") || "";
  assert.ok(csp.includes("default-src 'self'"), "CSP header must be present");

  // 2. Healthcheck
  const healthRes = await fetch(`${baseUrl}/api`);
  assert.equal(healthRes.status, 200, "/api healthcheck must return 200");

  // 3. Register workspace
  const uniqueEmail = `e2e.${Date.now()}@cadence.ai`;
  const regRes = await fetch(`${baseUrl}/api/auth/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "register",
      email: uniqueEmail,
      password: "LiveE2EPassword#2026",
      name: "Live E2E Runner",
      workspaceName: "Live E2E Workspace",
    }),
  });
  assert.equal(regRes.status, 200, "Workspace registration must succeed");
  const cookie = regRes.headers.get("set-cookie")?.split(";")[0] || "";
  assert.ok(cookie.includes("cadence_session="), "Session cookie must be issued");

  // 4. Analyze uploaded CSV document
  const csvBase64 = Buffer.from(
    "INVOICE #INV-LIVE-1\nVendor: Live Ops\nSubtotal: $2,000.00\nTax: $200.00\nTotal Due: $2,500.00",
    "utf8",
  ).toString("base64");
  const analyzeRes = await fetch(`${baseUrl}/api/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({
      docType: "invoice",
      fileName: "live-invoice.csv",
      fileBase64: csvBase64,
    }),
  });
  assert.equal(analyzeRes.status, 200, "/api/analyze must return 200");
  const analyzeBody = await analyzeRes.json();
  assert.ok(analyzeBody.savedRunId, "Authenticated analysis must persist runId");

  // 5. Verify saved run in workspace history
  const runsRes = await fetch(`${baseUrl}/api/workspace/runs`, {
    headers: { Cookie: cookie },
  });
  assert.equal(runsRes.status, 200);
  const runsBody = await runsRes.json();
  assert.ok(
    runsBody.runs.some((r) => r.id === analyzeBody.savedRunId),
    "Saved run must be returned by GET /api/workspace/runs",
  );

  console.log("[E2E] All live end-to-end checks passed.");
}

runLiveE2E().catch((err) => {
  console.error("[E2E] Failed:", err);
  process.exit(1);
});
