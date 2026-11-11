import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

/**
 * Compiles TypeScript source modules (src/lib/*.ts and src/app/api/**\/route.ts)
 * into temporary ESM modules using TypeScript or Babel's TypeScript AST plugin
 * so `node --test` can execute unit and API route integration tests directly.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);

export function transpileTsToEsm(source, filename, isTSX = false) {
  let rewritten = source
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

function writeTestMocks(cacheDir) {
  // Mock next/server
  fs.writeFileSync(
    path.join(cacheDir, "mock-next-server.mjs"),
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

  // Mock z-ai-web-dev-sdk
  fs.writeFileSync(
    path.join(cacheDir, "mock-zai-sdk.mjs"),
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

  // Mock @prisma/client with controllable state
  fs.writeFileSync(
    path.join(cacheDir, "mock-prisma.mjs"),
    `export const mockWaitlistRows = new Map();
export let mockDbShouldFail = false;
export function setMockDbShouldFail(v) { mockDbShouldFail = v; }
export function resetMockDb() { mockWaitlistRows.clear(); mockDbShouldFail = false; }
export class PrismaClient {
  async $queryRaw() {
    if (mockDbShouldFail) throw new Error("SQLite disk I/O error");
    return [{ 1: 1 }];
  }
  waitlist = {
    create: async ({ data }) => {
      if (mockDbShouldFail) throw new Error("Database connection refused");
      if (mockWaitlistRows.has(data.email)) {
        const err = new Error("Unique constraint failed");
        err.code = "P2002";
        throw err;
      }
      mockWaitlistRows.set(data.email, data);
      return data;
    },
    count: async () => {
      if (mockDbShouldFail) throw new Error("Database connection refused");
      return mockWaitlistRows.size;
    }
  };
}
`,
    "utf8",
  );
}

let compiledOnce = false;

export function ensureCompiledCache() {
  const cacheDir = path.join(repoRoot, ".test-build");
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
  const cacheDir = ensureCompiledCache();
  const base = path.basename(relPathFromRoot);
  let targetFile = base.replace(/\.ts$/, ".mjs");
  if (relPathFromRoot === "src/app/api/route.ts") targetFile = "route-health.mjs";
  if (relPathFromRoot === "src/app/api/chat/route.ts") targetFile = "route-chat.mjs";
  if (relPathFromRoot === "src/app/api/analyze/route.ts") targetFile = "route-analyze.mjs";
  if (relPathFromRoot === "src/app/api/subscribe/route.ts") targetFile = "route-subscribe.mjs";

  return import(path.join(cacheDir, targetFile));
}

export async function loadTestMocks() {
  const cacheDir = ensureCompiledCache();
  const zaiMock = await import(path.join(cacheDir, "mock-zai-sdk.mjs"));
  const prismaMock = await import(path.join(cacheDir, "mock-prisma.mjs"));
  return { zaiMock, prismaMock };
}
