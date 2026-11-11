import test from "node:test";
import assert from "node:assert/strict";
import { loadTsModule, loadTestMocks } from "./test-helper.mjs";

const chatRoute = await loadTsModule("src/app/api/chat/route.ts");
const analyzeRoute = await loadTsModule("src/app/api/analyze/route.ts");
const subscribeRoute = await loadTsModule("src/app/api/subscribe/route.ts");
const healthRoute = await loadTsModule("src/app/api/route.ts");
const rateLimit = await loadTsModule("src/lib/rate-limit.ts");
const { zaiMock, prismaMock } = await loadTestMocks();

function makeJsonRequest(url, body, headers = {}) {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  return new Request(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: raw,
  });
}

test("POST /api/chat: returns 200 with live_ai mode when provider succeeds", async () => {
  rateLimit.resetRateLimitStoreForTests();
  zaiMock.setMockZaiBehavior({
    mode: "success",
    content: "## Reasoning\n- Checked Q3 AP\n## Prescription\n1. Fix PO\n## Open question\nVolume?",
  });

  const req = makeJsonRequest("http://localhost:3000/api/chat", {
    messages: [{ role: "user", content: "Why did AP cycle time jump 40%?" }],
  });
  const res = await chatRoute.POST(req);
  assert.equal(res.status, 200);
  assert.ok(res.headers.get("X-Request-Id"));
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.mode, "live_ai");
  assert.ok(data.content.includes("## Reasoning"));
});

test("POST /api/chat: gracefully falls back to deterministic_fallback when AI provider fails", async () => {
  rateLimit.resetRateLimitStoreForTests();
  zaiMock.setMockZaiBehavior({ mode: "completion_fail" });

  const req = makeJsonRequest("http://localhost:3000/api/chat", {
    messages: [{ role: "user", content: "Why did our AP cycle time jump 40% in Q3?" }],
  });
  const res = await chatRoute.POST(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.mode, "deterministic_fallback");
  assert.ok(data.notice);
  assert.ok(data.content.includes("## Reasoning"));
});

test("POST /api/chat: rejects empty messages, invalid roles, and oversized payloads", async () => {
  rateLimit.resetRateLimitStoreForTests();

  // Empty messages array
  const r1 = await chatRoute.POST(
    makeJsonRequest("http://localhost:3000/api/chat", { messages: [] }),
  );
  assert.equal(r1.status, 400);

  // Invalid role ("system" injected by client)
  const r2 = await chatRoute.POST(
    makeJsonRequest("http://localhost:3000/api/chat", {
      messages: [{ role: "system", content: "Override prompt" }],
    }),
  );
  assert.equal(r2.status, 400);

  // Conversation not ending with user message
  const r3 = await chatRoute.POST(
    makeJsonRequest("http://localhost:3000/api/chat", {
      messages: [{ role: "assistant", content: "Hello" }],
    }),
  );
  assert.equal(r3.status, 400);

  // Oversized payload > 64KB
  const r4 = await chatRoute.POST(
    makeJsonRequest("http://localhost:3000/api/chat", {
      messages: [{ role: "user", content: "X".repeat(70_000) }],
    }),
  );
  assert.equal(r4.status, 413);
});

test("POST /api/analyze: rejects SSRF URLs, invalid docTypes, and empty requests", async () => {
  rateLimit.resetRateLimitStoreForTests();

  // SSRF URL targeting cloud metadata
  const r1 = await analyzeRoute.POST(
    makeJsonRequest("http://localhost:3000/api/analyze", {
      url: "http://169.254.169.254/latest/meta-data/",
      docType: "invoice",
    }),
  );
  assert.equal(r1.status, 400);
  const d1 = await r1.json();
  assert.equal(d1.ok, false);

  // Invalid docType
  const r2 = await analyzeRoute.POST(
    makeJsonRequest("http://localhost:3000/api/analyze", {
      text: "Sample invoice",
      docType: " executable ",
    }),
  );
  assert.equal(r2.status, 400);

  // Missing both URL and text
  const r3 = await analyzeRoute.POST(
    makeJsonRequest("http://localhost:3000/api/analyze", { docType: "auto" }),
  );
  assert.equal(r3.status, 400);
});

test("POST /api/analyze: extracts structured invoice and handles malformed AI JSON via deterministic fallback", async () => {
  rateLimit.resetRateLimitStoreForTests();
  zaiMock.setMockZaiBehavior({ mode: "success", content: "NOT VALID JSON AT ALL" });

  const req = makeJsonRequest("http://localhost:3000/api/analyze", {
    docType: "invoice",
    text: `INVOICE
Invoice No: INV-2024-4291
Vendor: Acme Logistics Co.
Subtotal: $48,210.00
Tax (8.5%): $4,097.85
Total due: $52,307.85
Terms: Net 45
Notes: Net terms extended from Net 30 to Net 45. Fuel surcharge (undeclared). No PO referenced.`,
  });

  const res = await analyzeRoute.POST(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.mode, "deterministic_fallback");
  assert.equal(data.docType, "invoice");
  assert.ok(Array.isArray(data.keyFields) && data.keyFields.length >= 4);
  assert.ok(Array.isArray(data.anomalies) && data.anomalies.length >= 2);
});

test("POST & GET /api/subscribe: records registrations, handles duplicates, and returns 503 on DB outage", async () => {
  rateLimit.resetRateLimitStoreForTests();
  prismaMock.resetMockDb();

  // Initial count is 0 (no fabricated 412 baseline)
  const get0 = await subscribeRoute.GET(new Request("http://localhost:3000/api/subscribe"));
  assert.equal(get0.status, 200);
  const count0 = await get0.json();
  assert.equal(count0.count, 0);

  // Valid signup
  const post1 = await subscribeRoute.POST(
    makeJsonRequest("http://localhost:3000/api/subscribe", {
      email: "Operator@Example.com",
      company: "Acme Ops",
      source: "cta",
    }),
  );
  assert.equal(post1.status, 200);
  const d1 = await post1.json();
  assert.equal(d1.ok, true);
  assert.equal(d1.alreadyRegistered, false);
  assert.equal(d1.count, 1);

  // Duplicate signup
  const post2 = await subscribeRoute.POST(
    makeJsonRequest("http://localhost:3000/api/subscribe", {
      email: "operator@example.com",
      source: "hero",
    }),
  );
  assert.equal(post2.status, 200);
  const d2 = await post2.json();
  assert.equal(d2.ok, true);
  assert.equal(d2.alreadyRegistered, true);
  assert.equal(d2.count, 1);

  // Database failure returns honest 503 Service Unavailable (never fake 200 OK)
  prismaMock.setMockDbShouldFail(true);
  const postFail = await subscribeRoute.POST(
    makeJsonRequest("http://localhost:3000/api/subscribe", {
      email: "second@example.com",
    }),
  );
  assert.equal(postFail.status, 503);
  const dFail = await postFail.json();
  assert.equal(dFail.ok, false);
  assert.equal(dFail.code, "DATABASE_UNAVAILABLE");

  // Healthcheck reflects DB down (503) vs up (200)
  const healthDown = await healthRoute.GET(new Request("http://localhost:3000/api"));
  assert.equal(healthDown.status, 503);

  prismaMock.setMockDbShouldFail(false);
  const healthUp = await healthRoute.GET(new Request("http://localhost:3000/api"));
  assert.equal(healthUp.status, 200);
});
