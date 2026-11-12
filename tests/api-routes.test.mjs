import test from "node:test";
import assert from "node:assert/strict";
import zlib from "node:zlib";
import { loadTsModule, loadTestMocks } from "./test-helper.mjs";

const { zaiMock, prismaMock } = await loadTestMocks();
const rateLimitMod = await loadTsModule("src/lib/rate-limit.ts");
const chatRoute = await loadTsModule("src/app/api/chat/route.ts");
const analyzeRoute = await loadTsModule("src/app/api/analyze/route.ts");
const subscribeRoute = await loadTsModule("src/app/api/subscribe/route.ts");
const authSessionRoute = await loadTsModule("src/app/api/auth/session/route.ts");
const workspaceRunsRoute = await loadTsModule("src/app/api/workspace/runs/route.ts");
const workspaceMembersRoute = await loadTsModule("src/app/api/workspace/members/route.ts");
const healthRoute = await loadTsModule("src/app/api/route.ts");

function makeJsonRequest(url, method, bodyObj, extraHeaders = {}) {
  const bodyStr = bodyObj !== undefined ? JSON.stringify(bodyObj) : undefined;
  return new Request(url, {
    method,
    headers: {
      "content-type": "application/json",
      ...(bodyStr
        ? { "content-length": String(Buffer.byteLength(bodyStr)) }
        : {}),
      ...extraHeaders,
    },
    body: bodyStr,
  });
}

function makeSpoofedStreamRequest(url, method, totalByteLength, spoofedContentLength = "16") {
  const chunkSize = 8192;
  let sent = 0;
  const stream = new ReadableStream({
    pull(controller) {
      if (sent >= totalByteLength) {
        controller.close();
        return;
      }
      const size = Math.min(chunkSize, totalByteLength - sent);
      sent += size;
      controller.enqueue(new Uint8Array(size).fill(0x61));
    },
  });
  return new Request(url, {
    method,
    headers: {
      "content-type": "application/json",
      "content-length": spoofedContentLength,
    },
    body: stream,
    duplex: "half",
  });
}

test("POST /api/chat: returns 200 with live_ai mode when provider succeeds", async () => {
  rateLimitMod.resetRateLimitStoreForTests();
  zaiMock.setMockZaiBehavior({
    mode: "success",
    content:
      "## Reasoning\n- Found 12 stuck invoices.\n\n## Prescription\n1. Release PO hold.\n\n## Open question\nWhich vendor is affected?",
  });

  const req = makeJsonRequest("http://localhost:3000/api/chat", "POST", {
    messages: [{ role: "user", content: "We have 12 stuck invoices." }],
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
  rateLimitMod.resetRateLimitStoreForTests();
  zaiMock.setMockZaiBehavior({ mode: "completion_fail" });

  const req = makeJsonRequest("http://localhost:3000/api/chat", "POST", {
    messages: [
      {
        role: "user",
        content: "Our invoice queue has $45,000 stuck over 10 days.",
      },
    ],
  });

  const res = await chatRoute.POST(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.mode, "deterministic_fallback");
  assert.ok(data.notice);
  assert.ok(data.content.includes("## Prescription"));
});

test("Streaming Body Limit Enforcement: aborts chunked streams with spoofed Content-Length across all API routes", async () => {
  rateLimitMod.resetRateLimitStoreForTests();

  // 1. /api/chat (> 64 KB stream with spoofed Content-Length: 16)
  const chatRes = await chatRoute.POST(
    makeSpoofedStreamRequest("http://localhost:3000/api/chat", "POST", 80 * 1024, "16"),
  );
  assert.equal(chatRes.status, 413);
  const chatBody = await chatRes.json();
  assert.equal(chatBody.code, "PAYLOAD_TOO_LARGE");

  // 2. /api/subscribe (> 16 KB stream with spoofed Content-Length: 16)
  const subRes = await subscribeRoute.POST(
    makeSpoofedStreamRequest("http://localhost:3000/api/subscribe", "POST", 24 * 1024, "16"),
  );
  assert.equal(subRes.status, 413);

  // 3. /api/auth/session (> 16 KB stream with spoofed Content-Length: 16)
  const authRes = await authSessionRoute.POST(
    makeSpoofedStreamRequest("http://localhost:3000/api/auth/session", "POST", 24 * 1024, "16"),
  );
  assert.equal(authRes.status, 413);
});

test("POST /api/analyze: rejects SSRF URLs, invalid docTypes, and empty requests", async () => {
  rateLimitMod.resetRateLimitStoreForTests();

  const ssrfReq = makeJsonRequest("http://localhost:3000/api/analyze", "POST", {
    url: "http://169.254.169.254/latest/meta-data/",
    docType: "invoice",
  });
  const ssrfRes = await analyzeRoute.POST(ssrfReq);
  assert.equal(ssrfRes.status, 400);
  const ssrfBody = await ssrfRes.json();
  assert.equal(ssrfBody.ok, false);
  assert.equal(ssrfBody.code, "URL_FETCH_REJECTED");

  const badTypeReq = makeJsonRequest(
    "http://localhost:3000/api/analyze",
    "POST",
    {
      text: "Sample invoice text that is long enough to pass validation.",
      docType: "malicious_type",
    },
  );
  const badTypeRes = await analyzeRoute.POST(badTypeReq);
  assert.equal(badTypeRes.status, 400);
});

test("POST /api/analyze: extracts structured invoice from text and uploaded PDF files", async () => {
  rateLimitMod.resetRateLimitStoreForTests();
  zaiMock.setMockZaiBehavior({
    mode: "success",
    content: "Sorry, I cannot output JSON right now.",
  });

  const req = makeJsonRequest("http://localhost:3000/api/analyze", "POST", {
    docType: "invoice",
    text: `INVOICE #INV-7712
Vendor: Apex Industrial Supply
Subtotal: $10,000.00
Tax: $800.00
Total Due: $11,500.00
Payment Terms: Net 15`,
  });

  const res = await analyzeRoute.POST(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.mode, "deterministic_fallback");
  assert.equal(data.result.docType, "invoice");
  assert.ok(data.result.anomalies.some((a) => a.severity === "high"));

  const rawPdfContent =
    "BT (INVOICE #INV-8821) Tj (Subtotal: $4,000.00 Tax: $400.00 Total Due: $4,400.00) Tj ET";
  const compressed = zlib.deflateSync(Buffer.from(rawPdfContent, "latin1"));
  const pdfBuffer = Buffer.concat([
    Buffer.from("%PDF-1.4\n1 0 obj\n<< /Filter /FlateDecode >>\nstream\n", "latin1"),
    compressed,
    Buffer.from("\nendstream\nendobj\n%%EOF", "latin1"),
  ]);

  const pdfReq = makeJsonRequest("http://localhost:3000/api/analyze", "POST", {
    docType: "invoice",
    fileName: "vendor-bill.pdf",
    fileBase64: pdfBuffer.toString("base64"),
  });
  const pdfRes = await analyzeRoute.POST(pdfReq);
  assert.equal(pdfRes.status, 200);
  const pdfData = await pdfRes.json();
  assert.equal(pdfData.ok, true);
  assert.equal(pdfData.result.uploadedFormat, "pdf");
  assert.equal(pdfData.result.sourceTitle, "vendor-bill.pdf");
});

test("Transactional Auth, Account Lockout & RBAC: atomic rollback, brute-force lockout, and OWNER/MEMBER/VIEWER enforcement", async () => {
  rateLimitMod.resetRateLimitStoreForTests();
  prismaMock.resetMockDb();
  zaiMock.setMockZaiBehavior({ mode: "completion_fail" });

  // 1. Verify transactional rollback when a downstream step fails during registration
  prismaMock.setMockFailOnStep("workspaceMember.create");
  const failedReg = await authSessionRoute.POST(
    makeJsonRequest("http://localhost:3000/api/auth/session", "POST", {
      action: "register",
      email: "rollback@alpha.io",
      password: "StrongPassword#2026",
      name: "Rollback User",
      workspaceName: "Orphan Test Workspace",
    }),
  );
  assert.equal(failedReg.status, 503);
  assert.equal(prismaMock.mockWorkspaces.size, 0, "Workspace creation must roll back on transaction error");
  assert.equal(prismaMock.mockUsers.size, 0, "User creation must roll back on transaction error");
  prismaMock.setMockFailOnStep(null);

  // 2. Register Workspace Alpha (OWNER)
  const regAlpha = await authSessionRoute.POST(
    makeJsonRequest("http://localhost:3000/api/auth/session", "POST", {
      action: "register",
      email: "founder@alpha.io",
      password: "StrongPassword#2026",
      name: "Alpha Founder",
      workspaceName: "Alpha Operations",
    }),
  );
  assert.equal(regAlpha.status, 200);
  const alphaCookie = regAlpha.headers.get("set-cookie");
  assert.ok(alphaCookie && alphaCookie.includes("cadence_session="));
  const alphaToken = alphaCookie.split(";")[0];

  // 3. Run analysis as OWNER -> persists run
  const analyzeRes = await analyzeRoute.POST(
    makeJsonRequest(
      "http://localhost:3000/api/analyze",
      "POST",
      {
        docType: "invoice",
        text: "INVOICE #INV-100 Subtotal: $1,000.00 Tax: $100.00 Total: $1,100.00",
      },
      { cookie: alphaToken },
    ),
  );
  const analyzeData = await analyzeRes.json();
  assert.ok(analyzeData.savedRunId);

  // 4. Invite a VIEWER and a MEMBER to Workspace Alpha via POST /api/workspace/members
  const addViewerRes = await workspaceMembersRoute.POST(
    makeJsonRequest(
      "http://localhost:3000/api/workspace/members",
      "POST",
      {
        email: "viewer@alpha.io",
        name: "Alpha Viewer",
        role: "VIEWER",
        password: "ViewerPassword#2026",
      },
      { cookie: alphaToken },
    ),
  );
  assert.equal(addViewerRes.status, 200);

  const addMemberRes = await workspaceMembersRoute.POST(
    makeJsonRequest(
      "http://localhost:3000/api/workspace/members",
      "POST",
      {
        email: "member@alpha.io",
        name: "Alpha Member",
        role: "MEMBER",
        password: "MemberPassword#2026",
      },
      { cookie: alphaToken },
    ),
  );
  assert.equal(addMemberRes.status, 200);

  // 5. Sign in as VIEWER
  const loginViewer = await authSessionRoute.POST(
    makeJsonRequest("http://localhost:3000/api/auth/session", "POST", {
      action: "login",
      email: "viewer@alpha.io",
      password: "ViewerPassword#2026",
    }),
  );
  assert.equal(loginViewer.status, 200);
  const viewerToken = loginViewer.headers.get("set-cookie").split(";")[0];

  // VIEWER can read runs, but receives empty auditLogs (no audit:read) and 403 on DELETE run or POST member
  const viewerRunsRes = await workspaceRunsRoute.GET(
    new Request("http://localhost:3000/api/workspace/runs", {
      headers: { cookie: viewerToken },
    }),
  );
  const viewerRunsData = await viewerRunsRes.json();
  assert.equal(viewerRunsData.ok, true);
  assert.equal(viewerRunsData.role, "VIEWER");
  assert.equal(viewerRunsData.runs.length, 1);
  assert.equal(viewerRunsData.auditLogs.length, 0);

  const viewerDeleteRes = await workspaceRunsRoute.DELETE(
    makeJsonRequest(
      "http://localhost:3000/api/workspace/runs",
      "DELETE",
      { runId: analyzeData.savedRunId },
      { cookie: viewerToken },
    ),
  );
  assert.equal(viewerDeleteRes.status, 403);

  const viewerAddMemberRes = await workspaceMembersRoute.POST(
    makeJsonRequest(
      "http://localhost:3000/api/workspace/members",
      "POST",
      { email: "unauthorized@alpha.io", role: "MEMBER" },
      { cookie: viewerToken },
    ),
  );
  assert.equal(viewerAddMemberRes.status, 403);

  // 6. Sole OWNER cannot be demoted
  const alphaData = await regAlpha.json();
  const demoteOwnerRes = await workspaceMembersRoute.PATCH(
    makeJsonRequest(
      "http://localhost:3000/api/workspace/members",
      "PATCH",
      { userId: alphaData.user.id, role: "MEMBER" },
      { cookie: alphaToken },
    ),
  );
  assert.equal(demoteOwnerRes.status, 400);
  const demoteOwnerBody = await demoteOwnerRes.json();
  assert.equal(demoteOwnerBody.code, "LAST_OWNER_PROTECTED");
});

test("POST & GET /api/subscribe: records registrations, handles duplicates, and returns 503 on DB outage", async () => {
  rateLimitMod.resetRateLimitStoreForTests();
  prismaMock.resetMockDb();

  const get0 = await subscribeRoute.GET(
    new Request("http://localhost:3000/api/subscribe"),
  );
  const body0 = await get0.json();
  assert.equal(body0.ok, true);
  assert.equal(body0.count, 0);

  const sub1 = await subscribeRoute.POST(
    makeJsonRequest("http://localhost:3000/api/subscribe", "POST", {
      email: "ops.lead@example.com",
      source: "cta",
      company: "Acme Corp",
    }),
  );
  assert.equal(sub1.status, 200);
  const sub1Body = await sub1.json();
  assert.equal(sub1Body.ok, true);
  assert.equal(sub1Body.alreadyRegistered, false);
  assert.equal(sub1Body.count, 1);

  const sub2 = await subscribeRoute.POST(
    makeJsonRequest("http://localhost:3000/api/subscribe", "POST", {
      email: "OPS.LEAD@example.com",
      source: "hero",
    }),
  );
  assert.equal(sub2.status, 200);
  const sub2Body = await sub2.json();
  assert.equal(sub2Body.ok, true);
  assert.equal(sub2Body.alreadyRegistered, true);
  assert.equal(sub2Body.count, 1);

  prismaMock.setMockDbShouldFail(true);
  const subFail = await subscribeRoute.POST(
    makeJsonRequest("http://localhost:3000/api/subscribe", "POST", {
      email: "new.user@example.com",
    }),
  );
  assert.equal(subFail.status, 503);

  const healthFail = await healthRoute.GET(
    new Request("http://localhost:3000/api"),
  );
  assert.equal(healthFail.status, 503);

  prismaMock.setMockDbShouldFail(false);
  const healthOk = await healthRoute.GET(
    new Request("http://localhost:3000/api"),
  );
  assert.equal(healthOk.status, 200);
});
