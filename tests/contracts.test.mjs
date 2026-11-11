import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);

function readFile(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), "utf8");
}

function walkFiles(dir, extList = [".ts", ".tsx"]) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full, extList));
    } else if (extList.some((ext) => entry.name.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

test("Phase 2C & 2D: Every .ts and .tsx file in src/ parses cleanly into a valid AST and all imports resolve", () => {
  const babelParser = require("/usr/share/nodejs/@babel/parser");
  const srcDir = path.join(repoRoot, "src");
  const files = walkFiles(srcDir);
  assert.ok(files.length >= 80, `Expected at least 80 source files, found ${files.length}`);

  for (const file of files) {
    const code = fs.readFileSync(file, "utf8");
    const isTSX = file.endsWith(".tsx");
    assert.doesNotThrow(() => {
      babelParser.parse(code, {
        sourceType: "module",
        plugins: isTSX ? ["typescript", "jsx"] : ["typescript"],
      });
    }, `AST parse failed for ${file}`);

    // Verify all internal @/* and relative imports resolve to existing files
    const importRegex = /from\s+["'](@\/[^"']+|(?:\.\.?\/)[^"']+)["']/g;
    let match;
    while ((match = importRegex.exec(code)) !== null) {
      const spec = match[1];
      const base = spec.startsWith("@/")
        ? path.join(srcDir, spec.slice(2))
        : path.resolve(path.dirname(file), spec);
      const candidates = [
        base,
        `${base}.ts`,
        `${base}.tsx`,
        `${base}.css`,
        path.join(base, "index.ts"),
        path.join(base, "index.tsx"),
      ];
      assert.ok(
        candidates.some((c) => fs.existsSync(c)),
        `Unresolved import '${spec}' in ${file}`,
      );
    }
  }
});

test("Phase 2A & 2B: Hero and Pricing components are properly implemented and exported", () => {
  const hero = readFile("src/components/site/hero.tsx");
  assert.match(hero, /export\s+function\s+Hero\s*\(/);
  assert.equal(hero.includes("TODO"), false);

  const pricing = readFile("src/components/site/pricing.tsx");
  assert.match(pricing, /export\s+function\s+Pricing\s*\(/);
  assert.ok(pricing.includes("ContactSalesModal"));
});

test("Phase 4C: next.config.ts enforces strict TypeScript, reactStrictMode, CSP, and HSTS headers", () => {
  const nextConfig = readFile("next.config.ts");
  assert.ok(nextConfig.includes("reactStrictMode: true"));
  assert.ok(nextConfig.includes("ignoreBuildErrors: false"));
  assert.ok(nextConfig.includes("Content-Security-Policy"));
  assert.ok(nextConfig.includes("Strict-Transport-Security"));
  assert.ok(nextConfig.includes("X-Frame-Options"));
  assert.ok(nextConfig.includes("X-Content-Type-Options"));
});

test("Phase 5: Database & subscribe route remove BASE_WAITLIST_COUNT=412 and --accept-data-loss", () => {
  const subscribeRoute = readFile("src/app/api/subscribe/route.ts");
  assert.equal(subscribeRoute.includes("412"), false);
  assert.equal(subscribeRoute.includes("fallbackWaitlist"), false);
  assert.ok(subscribeRoute.includes("status: 503"));

  const waitlistHook = readFile("src/hooks/use-waitlist-count.ts");
  assert.equal(waitlistHook.includes("412"), false);

  const pkg = JSON.parse(readFile("package.json"));
  assert.equal(pkg.scripts["db:push"].includes("--accept-data-loss"), false);
  assert.ok(fs.existsSync(path.join(repoRoot, "prisma/migrations/20261111000000_init/migration.sql")));
});

test("Phase 6 & 7: Marketing, Security, Testimonial, and TrustBar components contain no fabricated claims", () => {
  const trustBar = readFile("src/components/site/trust-bar.tsx");
  assert.equal(trustBar.includes("Northwind"), false);
  assert.equal(trustBar.includes("1.2"), false);
  assert.equal(trustBar.includes("98"), false);

  const testimonials = readFile("src/components/site/testimonial.tsx");
  assert.equal(testimonials.includes("Maya Vance"), false);
  assert.equal(testimonials.includes("James Kim"), false);
  assert.equal(testimonials.includes("Aria Rao"), false);
  assert.ok(testimonials.includes("Illustrative"));

  const changelog = readFile("src/components/site/changelog.tsx");
  assert.equal(changelog.includes("SOC 2 Type II achieved"), false);

  const nav = readFile("src/components/site/nav.tsx");
  assert.equal(nav.includes(">Sign in<"), false);
});

test("Phase 7D & 10: Accessibility skip-link, reduced-motion CSS, and SEO sitemap/robots routes exist", () => {
  const page = readFile("src/app/page.tsx");
  assert.ok(page.includes('href="#main-content"'));
  assert.ok(page.includes('id="main-content"'));

  const css = readFile("src/app/globals.css");
  assert.ok(css.includes("prefers-reduced-motion: reduce"));
  assert.equal(css.includes("152 0)"), false);
  assert.equal(css.includes("160 0)"), false);

  assert.ok(fs.existsSync(path.join(repoRoot, "src/app/sitemap.ts")));
  assert.ok(fs.existsSync(path.join(repoRoot, "src/app/robots.ts")));
  assert.ok(fs.existsSync(path.join(repoRoot, ".github/workflows/ci.yml")));
});
