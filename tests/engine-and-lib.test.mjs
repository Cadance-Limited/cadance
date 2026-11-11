import test from "node:test";
import assert from "node:assert/strict";
import { loadTsModule } from "./test-helper.mjs";

const rateLimit = await loadTsModule("src/lib/rate-limit.ts");
const diagnostics = await loadTsModule("src/lib/diagnostics-engine.ts");
const loggerMod = await loadTsModule("src/lib/logger.ts");

test("Rate Limiter: ignores spoofed X-Forwarded-For when TRUST_PROXY is false", () => {
  process.env.TRUST_PROXY = "false";
  const h1 = new Headers({ "x-forwarded-for": "203.0.113.5" });
  const h2 = new Headers({ "x-forwarded-for": "198.51.100.9" });
  assert.equal(rateLimit.getClientIp(h1), "direct-client");
  assert.equal(rateLimit.getClientIp(h2), "direct-client");
});

test("Rate Limiter: extracts first client IP when TRUST_PROXY is true", () => {
  process.env.TRUST_PROXY = "true";
  const h = new Headers({ "x-forwarded-for": "198.51.100.42, 10.0.0.1" });
  assert.equal(rateLimit.getClientIp(h), "198.51.100.42");
  process.env.TRUST_PROXY = "false";
});

test("Rate Limiter: enforces sliding window limit and sets Retry-After header", async () => {
  rateLimit.resetRateLimitStoreForTests();
  const headers = new Headers();
  const opts = { namespace: "test:endpoint", limit: 2, windowMs: 60_000 };

  const r1 = await rateLimit.checkRateLimit(headers, opts);
  assert.equal(r1.allowed, true);
  assert.equal(r1.remaining, 1);

  const r2 = await rateLimit.checkRateLimit(headers, opts);
  assert.equal(r2.allowed, true);
  assert.equal(r2.remaining, 0);

  const r3 = await rateLimit.checkRateLimit(headers, opts);
  assert.equal(r3.allowed, false);
  assert.equal(r3.remaining, 0);
  assert.ok(Number(r3.headers["Retry-After"]) >= 1);
});

test("Diagnostics Engine: chat fallback never invents hours recovered and cites supplied figures", () => {
  const reply = diagnostics.generateDeterministicChatResponse([
    {
      role: "user",
      content: "Why did our AP cycle time jump 40% in Q3 — what should we fix first?",
    },
  ]);

  assert.ok(reply.includes("## Reasoning"));
  assert.ok(reply.includes("## Prescription"));
  assert.ok(reply.includes("## Open question"));
  assert.ok(reply.includes("40%"));
  // Must not fabricate "~6.2 hrs/week recovered" in deterministic fallback
  assert.equal(reply.includes("6.2 hrs"), false);
});

test("Diagnostics Engine: document analyzer verifies invoice math and flags discrepancies", () => {
  const badMathInvoice = `INVOICE
Invoice No: INV-900
Vendor: Test Freight Ltd.
Subtotal: $1,000.00
Tax (10%): $100.00
Total due: $1,250.00
Terms: Net 30`;

  const res = diagnostics.analyzeDocumentDeterministic(badMathInvoice, "invoice");
  assert.equal(res.docType, "invoice");
  const mathAnomaly = res.anomalies.find((a) =>
    a.title.toLowerCase().includes("arithmetic"),
  );
  assert.ok(mathAnomaly, "Expected arithmetic discrepancy anomaly to be flagged");
  assert.equal(mathAnomaly.severity, "high");
  // Never fabricates estHoursRecovered
  for (const rec of res.recommendations) {
    assert.equal(rec.estHoursRecovered, null);
  }
});

test("Diagnostics Engine: normalizeAnalysisPayload sanitizes malformed LLM output and severity enums", () => {
  const malformed = {
    docType: "INVALID_TYPE",
    summary: "   Valid summary   ",
    keyFields: [{ label: "Vendor", value: "Acme", flagged: "yes" }, null, "bad"],
    anomalies: [{ title: "Outlier", severity: "CRITICAL_INVALID", note: "Check" }],
    recommendations: [{ title: "Fix", rationale: "Why", estHoursRecovered: "" }],
    injectedProperty: "should_be_stripped",
  };

  const normalized = diagnostics.normalizeAnalysisPayload(malformed, "invoice");
  assert.equal(normalized.docType, "invoice");
  assert.equal(normalized.summary, "Valid summary");
  assert.equal(normalized.keyFields.length, 1);
  assert.equal(normalized.keyFields[0].flagged, true);
  assert.equal(normalized.anomalies[0].severity, "low");
  assert.equal(normalized.recommendations[0].estHoursRecovered, null);
  assert.equal("injectedProperty" in normalized, false);
});

test("Structured Logger: redacts document text, messages, tokens, and masks email addresses", () => {
  const redacted = loggerMod.redactMetadata({
    requestId: "req_12345678",
    email: "alice@example.com",
    text: "CONFIDENTIAL INVOICE BODY",
    token: "secret_token_123",
  });

  assert.equal(redacted.requestId, "req_12345678");
  assert.equal(redacted.email, "a***@example.com");
  assert.equal(redacted.text, "[REDACTED]");
  assert.equal(redacted.token, "[REDACTED]");
});
