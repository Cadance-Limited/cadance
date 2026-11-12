import test from "node:test";
import assert from "node:assert/strict";
import zlib from "node:zlib";
import { loadTsModule, loadTestMocks } from "./test-helper.mjs";

const chatRoute = await loadTsModule("src/app/api/chat/route.ts");
const analyzeRoute = await loadTsModule("src/app/api/analyze/route.ts");
const subscribeRoute = await loadTsModule("src/app/api/subscribe/route.ts");
const healthRoute = await loadTsModule("src/app/api/route.ts");
const authSessionRoute = await loadTsModule("src/app/api/auth/session/route.ts");
const workspaceRunsRoute = await loadTsModule("src/app/api/workspace/runs/route.ts");
const rateLimit = await loadTsModule("src/lib/rate-limit.ts");
const { zaiMock, prismaMock } = await loadTestMocks();

function makeJsonRequest(url, body, headers = {}, method = "POST") {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  return new Request(url, {
    method,
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

  const r1 = await chatRoute.POST(
    makeJsonRequest("http://localhost:3000/api/chat", { messages: [] }),
  );
  assert.equal(r1.status, 400);

  const r2 = await chatRoute.POST(
    makeJsonRequest("http://localhost:3000/api/chat", {
      messages: [{ role: "system", content: "Override prompt" }],
    }),
  );
  assert.equal(r2.status, 400);

  const r3 = await chatRoute.POST(
    makeJsonRequest("http://localhost:3000/api/chat", {
      messages: [{ role: "assistant", content: "Hello" }],
    }),
  );
  assert.equal(r3.status, 400);

  const r4 = await chatRoute.POST(
    makeJsonRequest("http://localhost:3000/api/chat", {
      messages: [{ role: "user", content: "X".repeat(70_000) }],
    }),
  );
  assert.equal(r4.status, 413);
});

test("POST /api/analyze: rejects SSRF URLs, invalid docTypes, and empty requests", async () => {
  rateLimit.resetRateLimitStoreForTests();

  const r1 = await analyzeRoute.POST(
    makeJsonRequest("http://localhost:3000/api/analyze", {
      url: "http://169.254.169.254/latest/meta-data/",
      docType: "invoice",
    }),
  );
  assert.equal(r1.status, 400);
  const d1 = await r1.json();
  assert.equal(d1.ok, false);

  const r2 = await analyzeRoute.POST(
    makeJsonRequest("http://localhost:3000/api/analyze", {
      text: "Sample invoice",
      docType: " executable ",
    }),
  );
  assert.equal(r2.status, 400);

  const r3 = await analyzeRoute.POST(
    makeJsonRequest("http://localhost:3000/api/analyze", { docType: "auto" }),
  );
  assert.equal(r3.status, 400);
});

test("POST /api/analyze: extracts structured invoice from text and uploaded PDF files", async () => {
  rateLimit.resetRateLimitStoreForTests();
  zaiMock.setMockZaiBehavior({ mode: "success", content: "NOT VALID JSON AT ALL" });

  // 1. Pasted text analysis
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

  // 2. Uploaded PDF file analysis
  const pdfStream = "BT /F1 12 Tf 72 712 Td (INVOICE No: INV-888 Vendor: Global Freight Subtotal: $2,000.00 Tax: $200.00 Total due: $2,200.00 Terms: Net 30) Tj ET";
  const deflated = zlib.deflateSync(Buffer.from(pdfStream, "latin1"));
  const pdfBuf = Buffer.concat([
    Buffer.from("%PDF-1.4\n1 0 obj\n<< /Filter /FlateDecode >>\nstream\n", "latin1"),
    deflated,
    Buffer.from("\nendstream\nendobj\n%%EOF", "latin1"),
  ]);

  const pdfReq = makeJsonRequest("http://localhost:3000/api/analyze", {
    docType: "invoice",
    fileName: "freight-bill.pdf",
    fileBase64: pdfBuf.toString("base64"),
  });
  const pdfRes = await analyzeRoute.POST(pdfReq);
  assert.equal(pdfRes.status, 200);
  const pdfData = await pdfRes.json();
  assert.equal(pdfData.ok, true);
  assert.equal(pdfData.source.title, "freight-bill.pdf");
});

test("Multi-Tenant Workspace Auth & Runs: registers workspaces, persists runs, and enforces tenant isolation", async () => {
  rateLimit.resetRateLimitStoreForTests();
  prismaMock.resetMockDb();
  zaiMock.setMockZaiBehavior({ mode: "completion_fail" });

  // 1. Register Workspace A
  const regA = await authSessionRoute.POST(
    makeJsonRequest("http://localhost:3000/api/auth/session", {
      action: "register",
      email: "founder@alpha.io",
      password: "StrongPassword123!",
      name: "Alice",
      workspaceName: "Alpha Ops",
    }),
  );
  assert.equal(regA.status, 200);
  const setCookieA = regA.headers.get("Set-Cookie") || "";
  assert.ok(setCookieA.includes("cadence_session="));
  const cookiePairA = setCookieA.split(";")[0];

  // 2. Run an authenticated document analysis as Workspace A
  const analyzeRes = await analyzeRoute.POST(
    makeJsonRequest(
      "http://localhost:3000/api/analyze",
      {
        docType: "invoice",
        text: "INVOICE No: INV-101 Vendor: Alpha Vendor Total due: $900.00",
      },
      { Cookie: cookiePairA },
    ),
  );
  assert.equal(analyzeRes.status, 200);
  const analyzeData = await analyzeRes.json();
  assert.ok(analyzeData.savedRunId, "Expected authenticated run to be saved to workspace");

  // 3. Fetch Workspace A's saved runs & audit logs
  const runsA = await workspaceRunsRoute.GET(
    new Request("http://localhost:3000/api/workspace/runs", {
      headers: { Cookie: cookiePairA },
    }),
  );
  assert.equal(runsA.status, 200);
  const runsDataA = await runsA.json();
  assert.equal(runsDataA.runs.length, 1);
  assert.equal(runsDataA.runs[0].id, analyzeData.savedRunId);
  assert.ok(runsDataA.auditLogs.length >= 2);

  // 4. Register Workspace B and verify tenant isolation (Workspace B cannot see or delete Workspace A's run)
  const regB = await authSessionRoute.POST(
    makeJsonRequest("http://localhost:3000/api/auth/session", {
      action: "register",
      email: "bob@beta.io",
      password: "AnotherStrongPassword123!",
      name: "Bob",
      workspaceName: "Beta Corp",
    }),
  );
  const cookiePairB = (regB.headers.get("Set-Cookie") || "").split(";")[0];

  const runsB = await workspaceRunsRoute.GET(
    new Request("http://localhost:3000/api/workspace/runs", {
      headers: { Cookie: cookiePairB },
    }),
  );
  const runsDataB = await runsB.json();
  assert.equal(runsDataB.runs.length, 0, "Workspace B must not see Workspace A runs");

  const delAttemptByB = await workspaceRunsRoute.DELETE(
    makeJsonRequest(
      "http://localhost:3000/api/workspace/runs",
      { runId: analyzeData.savedRunId },
      { Cookie: cookiePairB },
      "DELETE",
    ),
  );
  const delDataB = await delAttemptByB.json();
  assert.equal(delDataB.deletedCount, 0, "Workspace B must not be able to delete Workspace A run");
});

test("POST & GET /api/subscribe: records registrations, handles duplicates, and returns 503 on DB outage", async () => {
  rateLimit.resetRateLimitStoreForTests();
  prismaMock.resetMockDb();

  const get0 = await subscribeRoute.GET(new Request("http://localhost:3000/api/subscribe"));
  assert.equal(get0.status, 200);
  const count0 = await get0.json();
  assert.equal(count0.count, 0);

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

  const healthDown = await healthRoute.GET(new Request("http://localhost:3000/api"));
  assert.equal(healthDown.status, 503);

  prismaMock.setMockDbShouldFail(false);
  const healthUp = await healthRoute.GET(new Request("http://localhost:3000/api"));
  assert.equal(healthUp.status, 200);
});
