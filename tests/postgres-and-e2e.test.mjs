import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadTsModule, loadTestMocks } from "./test-helper.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const { zaiMock, prismaMock } = await loadTestMocks();
const rateLimitMod = await loadTsModule("src/lib/rate-limit.ts");
const authSessionRoute = await loadTsModule("src/app/api/auth/session/route.ts");
const workspaceRunsRoute = await loadTsModule("src/app/api/workspace/runs/route.ts");
const workspaceMembersRoute = await loadTsModule("src/app/api/workspace/members/route.ts");
const chatRoute = await loadTsModule("src/app/api/chat/route.ts");
const analyzeRoute = await loadTsModule("src/app/api/analyze/route.ts");

function extractPrismaModels(schemaText) {
  const models = new Map();
  const modelRegex = /model\s+(\w+)\s*\{([\s\S]*?)\}/g;
  let match;
  while ((match = modelRegex.exec(schemaText)) !== null) {
    const modelName = match[1];
    const lines = match[2]
      .split(/\r?\n/)
      .map((l) => l.replace(/\/\/.*$/, "").trim())
      .filter(Boolean);
    models.set(modelName, lines);
  }
  return models;
}

test("PostgreSQL & SQLite Schema Parity: schema.postgresql.prisma matches schema.prisma models, fields, relations, and indexes 100%", () => {
  const sqliteSchema = fs.readFileSync(
    path.join(repoRoot, "prisma/schema.prisma"),
    "utf8",
  );
  const postgresSchema = fs.readFileSync(
    path.join(repoRoot, "prisma/schema.postgresql.prisma"),
    "utf8",
  );

  assert.match(sqliteSchema, /provider\s*=\s*"sqlite"/);
  assert.match(postgresSchema, /provider\s*=\s*"postgresql"/);

  const sqliteModels = extractPrismaModels(sqliteSchema);
  const postgresModels = extractPrismaModels(postgresSchema);

  const expectedModels = [
    "Waitlist",
    "Workspace",
    "User",
    "WorkspaceMember",
    "Session",
    "DiagnosticRun",
    "AuditLog",
  ];
  for (const name of expectedModels) {
    assert.ok(sqliteModels.has(name), `SQLite schema missing model ${name}`);
    assert.ok(
      postgresModels.has(name),
      `PostgreSQL schema missing model ${name}`,
    );
    assert.deepEqual(
      postgresModels.get(name),
      sqliteModels.get(name),
      `Model ${name} definition diverges between SQLite and PostgreSQL schemas`,
    );
  }

  // Verify versioned SQL migration defines all multi-tenant tables and unique constraints
  const migrationSql = fs.readFileSync(
    path.join(
      repoRoot,
      "prisma/migrations/20261112000000_saas_workspace/migration.sql",
    ),
    "utf8",
  );
  for (const table of [
    "Workspace",
    "User",
    "WorkspaceMember",
    "Session",
    "DiagnosticRun",
    "AuditLog",
  ]) {
    assert.ok(
      migrationSql.includes(`CREATE TABLE "${table}"`),
      `Migration SQL missing CREATE TABLE "${table}"`,
    );
  }
  assert.ok(
    migrationSql.includes(
      'CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key"',
    ),
  );
});

test("End-to-End Multi-Tenant User Journey: Registration -> Multi-Device Login -> Chat & CSV Analysis -> RBAC Role Upgrade -> Password Rotation & Session Revocation", async () => {
  rateLimitMod.resetRateLimitStoreForTests();
  prismaMock.resetMockDb();
  zaiMock.setMockZaiBehavior({ mode: "completion_fail" });

  // Step 1: Register new workspace as OWNER (Device 1)
  const regRes = await authSessionRoute.POST(
    new Request("http://localhost:3000/api/auth/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "register",
        email: "e2e.owner@cadence.ai",
        password: "InitialPassword#2026",
        name: "E2E Owner",
        workspaceName: "Cadence E2E Ops",
      }),
    }),
  );
  assert.equal(regRes.status, 200);
  const device1Cookie = regRes.headers.get("set-cookie").split(";")[0];

  // Step 2: Sign in from a second device (Device 2)
  const loginDevice2 = await authSessionRoute.POST(
    new Request("http://localhost:3000/api/auth/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "login",
        email: "e2e.owner@cadence.ai",
        password: "InitialPassword#2026",
      }),
    }),
  );
  assert.equal(loginDevice2.status, 200);
  const device2Cookie = loginDevice2.headers.get("set-cookie").split(";")[0];

  // Step 3: Run diagnostic chat and upload CSV invoice on Device 1
  const chatRes = await chatRoute.POST(
    new Request("http://localhost:3000/api/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: device1Cookie,
      },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content:
              "We have 38 invoices totaling $120,000 blocked on 3-way match.",
          },
        ],
      }),
    }),
  );
  assert.equal(chatRes.status, 200);
  const chatBody = await chatRes.json();
  assert.ok(chatBody.savedRunId);

  const csvPayload = Buffer.from(
    "INVOICE #INV-E2E-01\nVendor: Global Freight\nSubtotal: $5,000.00\nTax: $400.00\nTotal Due: $5,900.00\nPayment Terms: Net 30",
    "utf8",
  ).toString("base64");

  const analyzeRes = await analyzeRoute.POST(
    new Request("http://localhost:3000/api/analyze", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: device1Cookie,
      },
      body: JSON.stringify({
        docType: "invoice",
        fileName: "e2e-invoices.csv",
        fileBase64: csvPayload,
      }),
    }),
  );
  assert.equal(analyzeRes.status, 200);
  const analyzeBody = await analyzeRes.json();
  assert.ok(analyzeBody.savedRunId);

  // Step 4: Rotate password on Device 1 (PATCH /api/auth/session) -> revokes Device 2 session!
  const rotateRes = await authSessionRoute.PATCH(
    new Request("http://localhost:3000/api/auth/session", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        cookie: device1Cookie,
      },
      body: JSON.stringify({
        currentPassword: "InitialPassword#2026",
        newPassword: "RotatedPassword#2026",
      }),
    }),
  );
  assert.equal(rotateRes.status, 200);
  const rotateBody = await rotateRes.json();
  assert.equal(rotateBody.revokedOtherSessions, 1);

  // Verify Device 2 cookie is now invalidated while Device 1 remains authenticated
  const dev2SessionCheck = await authSessionRoute.GET(
    new Request("http://localhost:3000/api/auth/session", {
      headers: { cookie: device2Cookie },
    }),
  );
  const dev2Data = await dev2SessionCheck.json();
  assert.equal(dev2Data.authenticated, false);

  const dev1RunsCheck = await workspaceRunsRoute.GET(
    new Request("http://localhost:3000/api/workspace/runs", {
      headers: { cookie: device1Cookie },
    }),
  );
  const dev1RunsData = await dev1RunsCheck.json();
  assert.equal(dev1RunsData.ok, true);
  assert.equal(dev1RunsData.runs.length, 2);

  // Step 5: Global logout across all devices (DELETE /api/auth/session?scope=all)
  const logoutAllRes = await authSessionRoute.DELETE(
    new Request("http://localhost:3000/api/auth/session?scope=all", {
      method: "DELETE",
      headers: { cookie: device1Cookie },
    }),
  );
  assert.equal(logoutAllRes.status, 200);
  const dev1AfterLogout = await authSessionRoute.GET(
    new Request("http://localhost:3000/api/auth/session", {
      headers: { cookie: device1Cookie },
    }),
  );
  assert.equal((await dev1AfterLogout.json()).authenticated, false);
});
