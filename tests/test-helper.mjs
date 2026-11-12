import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Portable TypeScript test compiler helper:
 * - Uses the project's declared `typescript` compiler (from node_modules) on local and CI runners
 * - Falls back to `@babel/core` + `@babel/plugin-transform-typescript` in offline sandboxes
 * - Isolates `.test-build/worker-<pid>` per test runner process to prevent parallel race conditions
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const cacheDir = path.join(repoRoot, ".test-build", `worker-${process.pid}`);

process.on("exit", () => {
  try {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    const parentCache = path.join(repoRoot, ".test-build");
    if (
      fs.existsSync(parentCache) &&
      fs.readdirSync(parentCache).length === 0
    ) {
      fs.rmdirSync(parentCache);
    }
  } catch {
    /* ignore */
  }
});

export function transpileTsToEsm(source, filename, isTSX = false) {
  const rewritten = source
    .replace(/from\s+["']@\/lib\/([A-Za-z0-9_-]+)["']/g, 'from "./$1.mjs"')
    .replace(/from\s+["'](\.\/[A-Za-z0-9_-]+)["']/g, 'from "$1.mjs"')
    .replace(/from\s+["']next\/server["']/g, 'from "./mock-next-server.mjs"')
    .replace(/from\s+["']z-ai-web-dev-sdk["']/g, 'from "./mock-zai-sdk.mjs"')
    .replace(/from\s+["']@prisma\/client["']/g, 'from "./mock-prisma.mjs"');

  try {
    const ts = require("typescript");
    const out = ts.transpileModule(rewritten, {
      fileName: filename,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        jsx: isTSX ? ts.JsxEmit.ReactJSX : ts.JsxEmit.None,
      },
    });
    return out.outputText;
  } catch {
    const babel = require("/usr/share/nodejs/@babel/core");
    const tsPlugin = require("/usr/share/nodejs/@babel/plugin-transform-typescript");
    const out = babel.transformSync(rewritten, {
      filename,
      plugins: [[tsPlugin, { isTSX }]],
      configFile: false,
      babelrc: false,
    });
    return out.code;
  }
}

function writeTestMocks(targetDir) {
  fs.writeFileSync(
    path.join(targetDir, "mock-next-server.mjs"),
    `export class NextResponse extends Response {
  static json(body, init = {}) {
    const headers = new Headers(init.headers || {});
    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
    return new Response(JSON.stringify(body), {
      status: init.status || 200,
      headers,
    });
  }
}
export class NextRequest extends Request {}
`,
    "utf8",
  );

  fs.writeFileSync(
    path.join(targetDir, "mock-zai-sdk.mjs"),
    `export let mockZaiBehavior = { mode: "success", content: "## Reasoning\\n- Live AI test\\n## Prescription\\n1. Action\\n## Open question\\nNext?" };
export function setMockZaiBehavior(b) { mockZaiBehavior = b; }
export default class ZAI {
  static async create() {
    if (mockZaiBehavior.mode === "init_fail") throw new Error("ZAI init failed");
    return new ZAI();
  }
  chat = {
    completions: {
      create: async () => {
        if (mockZaiBehavior.mode === "completion_fail") throw new Error("Upstream 503");
        if (mockZaiBehavior.mode === "empty") return { choices: [{ message: { content: "" } }] };
        return { choices: [{ message: { content: mockZaiBehavior.content } }] };
      }
    }
  };
}
`,
    "utf8",
  );

  fs.writeFileSync(
    path.join(targetDir, "mock-prisma.mjs"),
    `export const mockWaitlistRows = new Map();
export const mockWorkspaces = new Map();
export const mockUsers = new Map();
export const mockWorkspaceMembers = new Map();
export const mockSessions = new Map();
export const mockRuns = [];
export const mockAuditLogs = [];
export let mockDbShouldFail = false;
export let mockFailOnStep = null;

export function setMockDbShouldFail(v) { mockDbShouldFail = v; }
export function setMockFailOnStep(step) { mockFailOnStep = step; }
export function resetMockDb() {
  mockWaitlistRows.clear();
  mockWorkspaces.clear();
  mockUsers.clear();
  mockWorkspaceMembers.clear();
  mockSessions.clear();
  mockRuns.length = 0;
  mockAuditLogs.length = 0;
  mockDbShouldFail = false;
  mockFailOnStep = null;
}

let idSeq = 1;
function nextId(prefix) {
  return \`\${prefix}_\${idSeq++}\`;
}

function cloneMap(m) {
  const copy = new Map();
  for (const [k, v] of m.entries()) {
    copy.set(k, { ...v });
  }
  return copy;
}

function restoreMap(target, snapshot) {
  target.clear();
  for (const [k, v] of snapshot.entries()) {
    target.set(k, v);
  }
}

export class PrismaClient {
  $executeRawUnsafe = async () => {
    if (mockDbShouldFail) throw new Error("SQLite PRAGMA failure");
    return 1;
  };
  $queryRaw = async () => {
    if (mockDbShouldFail) throw new Error("SQLite disk I/O error");
    return [{ 1: 1 }];
  };
  $transaction = async (fn) => {
    if (mockDbShouldFail) throw new Error("Database connection refused");
    // Snapshot state for atomic rollback on failure
    const snapWorkspaces = cloneMap(mockWorkspaces);
    const snapUsers = cloneMap(mockUsers);
    const snapMembers = cloneMap(mockWorkspaceMembers);
    const snapSessions = cloneMap(mockSessions);
    const snapRuns = mockRuns.map((r) => ({ ...r }));
    const snapAudits = mockAuditLogs.map((a) => ({ ...a }));

    try {
      return await fn(this);
    } catch (err) {
      restoreMap(mockWorkspaces, snapWorkspaces);
      restoreMap(mockUsers, snapUsers);
      restoreMap(mockWorkspaceMembers, snapMembers);
      restoreMap(mockSessions, snapSessions);
      mockRuns.length = 0;
      mockRuns.push(...snapRuns);
      mockAuditLogs.length = 0;
      mockAuditLogs.push(...snapAudits);
      throw err;
    }
  };
  waitlist = {
    create: async ({ data }) => {
      if (mockDbShouldFail) throw new Error("Database connection refused");
      if (mockWaitlistRows.has(data.email)) {
        const err = new Error("Unique constraint failed on the fields: (\`email\`)");
        err.code = "P2002";
        throw err;
      }
      const row = { id: nextId("wl"), ...data, createdAt: new Date() };
      mockWaitlistRows.set(data.email, row);
      return row;
    },
    count: async () => {
      if (mockDbShouldFail) throw new Error("Database connection refused");
      return mockWaitlistRows.size;
    }
  };
  workspace = {
    create: async ({ data }) => {
      if (mockDbShouldFail || mockFailOnStep === "workspace.create") throw new Error("DB error");
      const ws = { id: nextId("ws"), ...data, createdAt: new Date(), updatedAt: new Date() };
      mockWorkspaces.set(ws.id, ws);
      return ws;
    },
    findUnique: async ({ where }) => {
      if (mockDbShouldFail) throw new Error("DB error");
      if (where.id) return mockWorkspaces.get(where.id) || null;
      for (const ws of mockWorkspaces.values()) {
        if (ws.slug === where.slug) return ws;
      }
      return null;
    }
  };
  user = {
    create: async ({ data }) => {
      if (mockDbShouldFail || mockFailOnStep === "user.create") throw new Error("DB error on user.create");
      for (const u of mockUsers.values()) {
        if (u.email === data.email) {
          const err = new Error("Unique email");
          err.code = "P2002";
          throw err;
        }
      }
      const u = { id: nextId("usr"), ...data, createdAt: new Date(), updatedAt: new Date() };
      mockUsers.set(u.id, u);
      return u;
    },
    findUnique: async ({ where, include }) => {
      if (mockDbShouldFail) throw new Error("DB error");
      let found = null;
      if (where.id) found = mockUsers.get(where.id) || null;
      else if (where.email) {
        for (const u of mockUsers.values()) {
          if (u.email === where.email) { found = u; break; }
        }
      }
      if (!found) return null;
      if (include?.workspace) {
        return { ...found, workspace: mockWorkspaces.get(found.workspaceId) };
      }
      return found;
    },
    update: async ({ where, data }) => {
      if (mockDbShouldFail) throw new Error("DB error");
      const found = mockUsers.get(where.id);
      if (!found) throw new Error("User not found");
      const updated = { ...found, ...data, updatedAt: new Date() };
      mockUsers.set(where.id, updated);
      return updated;
    },
    updateMany: async ({ where, data }) => {
      let count = 0;
      for (const [id, u] of mockUsers.entries()) {
        if ((!where.id || u.id === where.id) && (!where.workspaceId || u.workspaceId === where.workspaceId)) {
          mockUsers.set(id, { ...u, ...data, updatedAt: new Date() });
          count++;
        }
      }
      return { count };
    }
  };
  workspaceMember = {
    create: async ({ data }) => {
      if (mockDbShouldFail || mockFailOnStep === "workspaceMember.create") throw new Error("DB error on workspaceMember.create");
      const key = \`\${data.workspaceId}:\${data.userId}\`;
      if (mockWorkspaceMembers.has(key)) {
        const err = new Error("Unique workspaceId_userId");
        err.code = "P2002";
        throw err;
      }
      const row = { id: nextId("wm"), ...data, createdAt: new Date(), updatedAt: new Date() };
      mockWorkspaceMembers.set(key, row);
      return row;
    },
    findUnique: async ({ where }) => {
      if (mockDbShouldFail) throw new Error("DB error");
      if (where.workspaceId_userId) {
        const key = \`\${where.workspaceId_userId.workspaceId}:\${where.workspaceId_userId.userId}\`;
        return mockWorkspaceMembers.get(key) || null;
      }
      return null;
    },
    findMany: async ({ where, include }) => {
      if (mockDbShouldFail) throw new Error("DB error");
      const list = [];
      for (const m of mockWorkspaceMembers.values()) {
        if (!where?.workspaceId || m.workspaceId === where.workspaceId) {
          if (include?.user) {
            list.push({ ...m, user: mockUsers.get(m.userId) });
          } else {
            list.push(m);
          }
        }
      }
      return list;
    },
    upsert: async ({ where, update, create }) => {
      const key = \`\${where.workspaceId_userId.workspaceId}:\${where.workspaceId_userId.userId}\`;
      const existing = mockWorkspaceMembers.get(key);
      if (existing) {
        const updated = { ...existing, ...update, updatedAt: new Date() };
        mockWorkspaceMembers.set(key, updated);
        return updated;
      }
      const created = { id: nextId("wm"), ...create, createdAt: new Date(), updatedAt: new Date() };
      mockWorkspaceMembers.set(key, created);
      return created;
    },
    update: async ({ where, data }) => {
      const key = \`\${where.workspaceId_userId.workspaceId}:\${where.workspaceId_userId.userId}\`;
      const existing = mockWorkspaceMembers.get(key);
      if (!existing) throw new Error("Member not found");
      const updated = { ...existing, ...data, updatedAt: new Date() };
      mockWorkspaceMembers.set(key, updated);
      return updated;
    },
    delete: async ({ where }) => {
      const key = \`\${where.workspaceId_userId.workspaceId}:\${where.workspaceId_userId.userId}\`;
      const existing = mockWorkspaceMembers.get(key);
      mockWorkspaceMembers.delete(key);
      return existing;
    },
    count: async ({ where }) => {
      let c = 0;
      for (const m of mockWorkspaceMembers.values()) {
        if ((!where?.workspaceId || m.workspaceId === where.workspaceId) && (!where?.role || m.role === where.role)) {
          c++;
        }
      }
      return c;
    }
  };
  session = {
    create: async ({ data }) => {
      if (mockDbShouldFail || mockFailOnStep === "session.create") throw new Error("DB error on session.create");
      const s = { id: nextId("ses"), ...data, createdAt: new Date() };
      mockSessions.set(s.tokenHash, s);
      return s;
    },
    findUnique: async ({ where, include }) => {
      if (mockDbShouldFail) throw new Error("DB error");
      const s = mockSessions.get(where.tokenHash) || null;
      if (!s) return null;
      if (include?.user || include?.workspace) {
        return {
          ...s,
          user: mockUsers.get(s.userId),
          workspace: mockWorkspaces.get(s.workspaceId),
        };
      }
      return s;
    },
    delete: async ({ where }) => {
      for (const [k, v] of mockSessions.entries()) {
        if (v.id === where.id) mockSessions.delete(k);
      }
    },
    deleteMany: async ({ where }) => {
      let count = 0;
      if (where?.tokenHash) {
        if (mockSessions.delete(where.tokenHash)) count++;
        return { count };
      }
      for (const [k, v] of mockSessions.entries()) {
        if (where?.expiresAt?.lte && v.expiresAt <= where.expiresAt.lte) {
          mockSessions.delete(k);
          count++;
          continue;
        }
        if (where?.userId && v.userId === where.userId) {
          if (where.id?.not && v.id === where.id.not) continue;
          if (where.workspaceId && v.workspaceId !== where.workspaceId) continue;
          mockSessions.delete(k);
          count++;
        }
      }
      return { count };
    }
  };
  diagnosticRun = {
    create: async ({ data }) => {
      if (mockDbShouldFail) throw new Error("DB error");
      const r = { id: nextId("run"), ...data, createdAt: new Date() };
      mockRuns.unshift(r);
      return r;
    },
    findMany: async ({ where }) => {
      if (mockDbShouldFail) throw new Error("DB error");
      return mockRuns.filter((r) => r.workspaceId === where.workspaceId);
    },
    deleteMany: async ({ where }) => {
      if (mockDbShouldFail) throw new Error("DB error");
      const before = mockRuns.length;
      for (let i = mockRuns.length - 1; i >= 0; i--) {
        if (mockRuns[i].id === where.id && mockRuns[i].workspaceId === where.workspaceId) {
          mockRuns.splice(i, 1);
        }
      }
      return { count: before - mockRuns.length };
    }
  };
  auditLog = {
    create: async ({ data }) => {
      if (mockDbShouldFail) throw new Error("DB error");
      const a = { id: nextId("aud"), ...data, createdAt: new Date() };
      mockAuditLogs.unshift(a);
      return a;
    },
    findMany: async ({ where }) => {
      if (mockDbShouldFail) throw new Error("DB error");
      return mockAuditLogs.filter((a) => a.workspaceId === where.workspaceId);
    }
  };
}
`,
    "utf8",
  );
}

let compiledOnce = false;

export function ensureCompiledCache() {
  if (compiledOnce && fs.existsSync(cacheDir)) return cacheDir;
  fs.mkdirSync(cacheDir, { recursive: true });
  writeTestMocks(cacheDir);

  const libDir = path.join(repoRoot, "src", "lib");
  for (const file of fs.readdirSync(libDir)) {
    if (!file.endsWith(".ts")) continue;
    const fullPath = path.join(libDir, file);
    const raw = fs.readFileSync(fullPath, "utf8");
    const js = transpileTsToEsm(raw, fullPath, false);
    const outFile = path.join(cacheDir, file.replace(/\.ts$/, ".mjs"));
    fs.writeFileSync(outFile, js, "utf8");
  }

  const routes = [
    ["src/app/api/route.ts", "route-health.mjs"],
    ["src/app/api/chat/route.ts", "route-chat.mjs"],
    ["src/app/api/analyze/route.ts", "route-analyze.mjs"],
    ["src/app/api/subscribe/route.ts", "route-subscribe.mjs"],
    ["src/app/api/auth/session/route.ts", "route-auth-session.mjs"],
    ["src/app/api/workspace/runs/route.ts", "route-workspace-runs.mjs"],
    ["src/app/api/workspace/members/route.ts", "route-workspace-members.mjs"],
  ];
  for (const [rel, outName] of routes) {
    const fullPath = path.join(repoRoot, rel);
    const raw = fs.readFileSync(fullPath, "utf8");
    const js = transpileTsToEsm(raw, fullPath, false);
    fs.writeFileSync(path.join(cacheDir, outName), js, "utf8");
  }

  compiledOnce = true;
  return cacheDir;
}

export async function loadTsModule(relPathFromRoot) {
  const dir = ensureCompiledCache();
  const base = path.basename(relPathFromRoot);
  let targetFile = base.replace(/\.ts$/, ".mjs");
  if (relPathFromRoot === "src/app/api/route.ts")
    targetFile = "route-health.mjs";
  if (relPathFromRoot === "src/app/api/chat/route.ts")
    targetFile = "route-chat.mjs";
  if (relPathFromRoot === "src/app/api/analyze/route.ts")
    targetFile = "route-analyze.mjs";
  if (relPathFromRoot === "src/app/api/subscribe/route.ts")
    targetFile = "route-subscribe.mjs";
  if (relPathFromRoot === "src/app/api/auth/session/route.ts")
    targetFile = "route-auth-session.mjs";
  if (relPathFromRoot === "src/app/api/workspace/runs/route.ts")
    targetFile = "route-workspace-runs.mjs";
  if (relPathFromRoot === "src/app/api/workspace/members/route.ts")
    targetFile = "route-workspace-members.mjs";

  return import(pathToFileURL(path.join(dir, targetFile)).href);
}

export async function loadTestMocks() {
  const dir = ensureCompiledCache();
  const zaiMock = await import(
    pathToFileURL(path.join(dir, "mock-zai-sdk.mjs")).href
  );
  const prismaMock = await import(
    pathToFileURL(path.join(dir, "mock-prisma.mjs")).href
  );
  return { zaiMock, prismaMock };
}
