import test from "node:test";
import assert from "node:assert/strict";
import zlib from "node:zlib";
import { loadTsModule } from "./test-helper.mjs";

const rateLimitMod = await loadTsModule("src/lib/rate-limit.ts");
const engineMod = await loadTsModule("src/lib/diagnostics-engine.ts");
const loggerMod = await loadTsModule("src/lib/logger.ts");
const authMod = await loadTsModule("src/lib/auth.ts");
const fileParserMod = await loadTsModule("src/lib/file-parser.ts");

function buildLocalZipEntry({
  entryName,
  rawData,
  compressionMethod = 8,
  flags = 0,
  declaredCompressedSize,
  declaredUncompressedSize,
}) {
  const nameBuf = Buffer.from(entryName, "utf8");
  const compressed =
    compressionMethod === 8 ? zlib.deflateRawSync(rawData) : rawData;
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0); // local file header signature
  header.writeUInt16LE(20, 4); // version needed
  header.writeUInt16LE(flags, 6);
  header.writeUInt16LE(compressionMethod, 8);
  header.writeUInt32LE(
    declaredCompressedSize ?? compressed.byteLength,
    18,
  );
  header.writeUInt32LE(
    declaredUncompressedSize ?? rawData.byteLength,
    22,
  );
  header.writeUInt16LE(nameBuf.byteLength, 26);
  header.writeUInt16LE(0, 28); // extra field length
  return Buffer.concat([header, nameBuf, compressed]);
}

test("Rate Limiter: ignores spoofed X-Forwarded-For AND rotatable User-Agent headers when TRUST_PROXY=false", async () => {
  delete process.env.TRUST_PROXY;
  rateLimitMod.resetRateLimitStoreForTests();

  const h1 = new Headers({
    "x-forwarded-for": "203.0.113.5",
    "user-agent": "AttackerBot/1.0",
  });
  const h2 = new Headers({
    "x-forwarded-for": "198.51.100.9",
    "user-agent": "AttackerBot/2.0-Rotated",
  });
  const h3 = new Headers({
    "x-forwarded-for": "192.0.2.88",
    "user-agent": "AttackerBot/3.0-Rotated",
  });

  // All unproxied requests must resolve to the exact same "unproxied-local" bucket
  assert.equal(rateLimitMod.getClientIp(h1), "unproxied-local");
  assert.equal(rateLimitMod.getClientIp(h2), "unproxied-local");

  const r1 = await rateLimitMod.checkRateLimit(h1, {
    namespace: "test:unproxied",
    limit: 2,
    windowMs: 60_000,
  });
  const r2 = await rateLimitMod.checkRateLimit(h2, {
    namespace: "test:unproxied",
    limit: 2,
    windowMs: 60_000,
  });
  const r3 = await rateLimitMod.checkRateLimit(h3, {
    namespace: "test:unproxied",
    limit: 2,
    windowMs: 60_000,
  });

  assert.equal(r1.allowed, true);
  assert.equal(r2.allowed, true);
  // Even though User-Agent and X-Forwarded-For were rotated on every request, the 3rd attempt is blocked!
  assert.equal(r3.allowed, false);
});

test("Rate Limiter: selects rightmost trusted hop on X-Forwarded-For when TRUST_PROXY=true to defeat leftmost spoofing", () => {
  process.env.TRUST_PROXY = "true";
  process.env.TRUSTED_PROXY_HOPS = "1";
  try {
    // Attacker sends X-Forwarded-For: 1.1.1.1, and ingress proxy appends actual client IP 198.51.100.42
    const headers = new Headers({
      "x-forwarded-for": "1.1.1.1, 198.51.100.42",
    });
    assert.equal(rateLimitMod.getClientIp(headers), "198.51.100.42");

    // With 2 trusted hops (e.g. CDN -> ALB), selects the 2nd from right
    process.env.TRUSTED_PROXY_HOPS = "2";
    const multiHopHeaders = new Headers({
      "x-forwarded-for": "1.1.1.1, 203.0.113.50, 10.0.0.5",
    });
    assert.equal(rateLimitMod.getClientIp(multiHopHeaders), "203.0.113.50");
  } finally {
    delete process.env.TRUST_PROXY;
    delete process.env.TRUSTED_PROXY_HOPS;
  }
});

test("Rate Limiter: enforces weighted sliding window limit and fails closed in production when unconfigured", async () => {
  rateLimitMod.resetRateLimitStoreForTests();
  const headers = new Headers();
  const opts = { namespace: "test:limit", limit: 3, windowMs: 60_000 };

  const r1 = await rateLimitMod.checkRateLimit(headers, opts);
  const r2 = await rateLimitMod.checkRateLimit(headers, opts);
  const r3 = await rateLimitMod.checkRateLimit(headers, opts);
  const r4 = await rateLimitMod.checkRateLimit(headers, opts);

  assert.equal(r1.allowed, true);
  assert.equal(r2.allowed, true);
  assert.equal(r3.allowed, true);
  assert.equal(r4.allowed, false);
  assert.ok(Number(r4.headers["Retry-After"]) >= 1);

  // Verify production fail-closed behavior when Redis is absent and ALLOW_IN_MEMORY_RATE_LIMIT=false
  const prevNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  process.env.DATABASE_URL = "file:./dev.db";
  process.env.ALLOW_IN_MEMORY_RATE_LIMIT = "false";
  try {
    const prodRes = await rateLimitMod.checkRateLimit(headers, {
      namespace: "test:prod",
      limit: 10,
      windowMs: 60_000,
    });
    assert.equal(prodRes.allowed, false);
    assert.equal(prodRes.remaining, 0);
  } finally {
    process.env.NODE_ENV = prevNodeEnv;
    delete process.env.ALLOW_IN_MEMORY_RATE_LIMIT;
  }
});

test("Diagnostics Engine: chat fallback never invents hours recovered and cites supplied figures", () => {
  const response = engineMod.generateDeterministicChatResponse([
    {
      role: "user",
      content:
        "Our AP team has 142 stuck invoices totaling $84,500 over 14 days due to 3-way match exceptions.",
    },
  ]);

  assert.ok(response.includes("## Reasoning"));
  assert.ok(response.includes("## Prescription"));
  assert.ok(response.includes("## Open question"));
  assert.ok(response.includes("142") || response.includes("$84,500"));
  assert.ok(!response.includes("412"));
});

test("Diagnostics Engine: document analyzer verifies invoice math and flags discrepancies", () => {
  const sampleInvoice = `
INVOICE #INV-2026-0891
Vendor: Northwind Logistics Ltd.
Issue Date: 2026-04-01
Due Date: 2026-05-01
Payment Terms: Net 15

Line Items:
1. Freight Handling — $10,000.00
2. Fuel Surcharge — $2,500.00

Subtotal: $12,500.00
Tax: $1,000.00
Total Due: $14,250.00
`;

  const analysis = engineMod.analyzeDocumentDeterministic(
    sampleInvoice,
    "invoice",
  );
  assert.equal(analysis.docType, "invoice");
  assert.ok(analysis.keyFields.length >= 4);

  const highAnomalies = analysis.anomalies.filter((a) => a.severity === "high");
  assert.ok(
    highAnomalies.length >= 1,
    "Expected high-severity invoice math discrepancy anomaly",
  );
  assert.ok(highAnomalies[0].title.toLowerCase().includes("arithmetic") || highAnomalies[0].title.toLowerCase().includes("discrepancy"));

  for (const rec of analysis.recommendations) {
    assert.equal(rec.estHoursRecovered, null);
  }
});

test("Diagnostics Engine: normalizeAnalysisPayload sanitizes malformed LLM output and severity enums", () => {
  const dirty = {
    docType: "invoice",
    summary: "Valid summary of the uploaded invoice.",
    keyFields: [
      { label: "Total", value: "$5,000.00", flagged: "yes", note: "Checked" },
      { label: "", value: "invalid" },
    ],
    anomalies: [
      {
        title: "Mismatch",
        severity: "CRITICAL_UNKNOWN",
        note: "Line item mismatch",
      },
    ],
    recommendations: [
      { title: "Hold payment", rationale: "Verify PO", estHoursRecovered: 123 },
    ],
  };

  const clean = engineMod.normalizeAnalysisPayload(dirty, "invoice");
  assert.ok(clean);
  assert.equal(clean.keyFields.length, 2);
  assert.equal(clean.keyFields[0].flagged, true);
  assert.equal(clean.keyFields[1].label, "Field");
  assert.equal(clean.anomalies[0].severity, "low");
  assert.equal(clean.recommendations[0].estHoursRecovered, null);
});

test("Structured Logger: redacts document text, messages, tokens, and masks email addresses", () => {
  const redacted = loggerMod.redactMetadata({
    requestId: "req_12345",
    email: "finance.director@enterprise.io",
    text: "CONFIDENTIAL CONTRACT BODY",
    messages: [{ role: "user", content: "secret" }],
    authorization: "Bearer secret_token",
    latencyMs: 42,
  });

  assert.equal(redacted.requestId, "req_12345");
  assert.equal(redacted.email, "f***@enterprise.io");
  assert.equal(redacted.text, "[REDACTED]");
  assert.equal(redacted.messages, "[REDACTED]");
  assert.equal(redacted.authorization, "[REDACTED]");
  assert.equal(redacted.latencyMs, 42);
});

test("Auth Engine: scrypt password hashing, constant-time dummy verification, and RBAC permission matrix", () => {
  const hash = authMod.hashPassword("CorrectHorseBatteryStaple!99");
  assert.ok(hash.startsWith("scrypt$"));
  assert.equal(
    authMod.verifyPassword("CorrectHorseBatteryStaple!99", hash),
    true,
  );
  assert.equal(authMod.verifyPassword("WrongPassword!99", hash), false);
  assert.equal(
    authMod.verifyPasswordAgainstDummy("AnyPasswordAttempt123!"),
    false,
  );

  // Verify RBAC role matrix
  assert.equal(authMod.hasWorkspacePermission("VIEWER", "runs:read"), true);
  assert.equal(authMod.hasWorkspacePermission("VIEWER", "runs:write"), false);
  assert.equal(authMod.hasWorkspacePermission("VIEWER", "runs:delete"), false);
  assert.equal(authMod.hasWorkspacePermission("MEMBER", "runs:write"), true);
  assert.equal(authMod.hasWorkspacePermission("MEMBER", "runs:delete"), false);
  assert.equal(authMod.hasWorkspacePermission("ADMIN", "runs:delete"), true);
  assert.equal(authMod.hasWorkspacePermission("ADMIN", "members:manage"), true);
  assert.equal(
    authMod.hasWorkspacePermission("ADMIN", "workspace:manage"),
    false,
  );
  assert.equal(
    authMod.hasWorkspacePermission("OWNER", "workspace:manage"),
    true,
  );
});

test("File Parser: natively extracts text from FlateDecode PDF streams, DOCX, CSV, and rejects unsupported formats", () => {
  const rawContent =
    "BT /F1 12 Tf 72 712 Td (INVOICE #INV-9901) Tj 0 -20 Td [(Subtotal: $1,000.00) -100 ( Total: $1,080.00)] TJ ET";
  const compressed = zlib.deflateSync(Buffer.from(rawContent, "latin1"));
  const pdfBuffer = Buffer.concat([
    Buffer.from("%PDF-1.4\n1 0 obj\n<< /Length ", "latin1"),
    Buffer.from(String(compressed.length), "latin1"),
    Buffer.from(" /Filter /FlateDecode >>\nstream\n", "latin1"),
    compressed,
    Buffer.from("\nendstream\nendobj\n%%EOF", "latin1"),
  ]);

  const parsedPdf = fileParserMod.parseUploadedDocument(
    "sample-invoice.pdf",
    pdfBuffer,
  );
  assert.equal(parsedPdf.ok, true);
  if (parsedPdf.ok) {
    assert.equal(parsedPdf.detectedFormat, "pdf");
    assert.ok(parsedPdf.extractedText.includes("INVOICE #INV-9901"));
    assert.ok(parsedPdf.extractedText.includes("Subtotal: $1,000.00"));
  }

  // Valid DOCX archive
  const docxEntry = buildLocalZipEntry({
    entryName: "word/document.xml",
    rawData: Buffer.from(
      "<w:document><w:body><w:p><w:t>INVOICE #INV-5500 Subtotal: $500.00 Total: $500.00</w:t></w:p></w:body></w:document>",
      "utf8",
    ),
  });
  const parsedDocx = fileParserMod.parseUploadedDocument(
    "contract.docx",
    docxEntry,
  );
  assert.equal(parsedDocx.ok, true);
  if (parsedDocx.ok) {
    assert.equal(parsedDocx.detectedFormat, "docx");
    assert.ok(parsedDocx.extractedText.includes("INVOICE #INV-5500"));
  }

  const csvBuffer = Buffer.from(
    "invoice_id,vendor,subtotal,tax,total\nINV-101,Acme Corp,$500.00,$50.00,$550.00",
    "utf8",
  );
  const parsedCsv = fileParserMod.parseUploadedDocument("ap.csv", csvBuffer);
  assert.equal(parsedCsv.ok, true);
  if (parsedCsv.ok) {
    assert.equal(parsedCsv.detectedFormat, "csv");
    assert.ok(parsedCsv.extractedText.includes("Acme Corp"));
  }

  const badFormat = fileParserMod.parseUploadedDocument(
    "malware.exe",
    Buffer.from("MZ9000", "utf8"),
  );
  assert.equal(badFormat.ok, false);
  if (!badFormat.ok) {
    assert.equal(badFormat.status, 415);
  }
});

test("File Parser Hardening: blocks ZIP bombs (>50:1 ratio), PDF decompression bombs, path traversal, encrypted archives, and corrupt deflate streams", () => {
  // 1. High-ratio ZIP bomb (100 KB of repeated 'A' compresses to a few hundred bytes -> >50:1 ratio)
  const bombPayload = Buffer.alloc(150 * 1024, "A");
  const zipBomb = buildLocalZipEntry({
    entryName: "word/document.xml",
    rawData: bombPayload,
  });
  const bombRes = fileParserMod.parseUploadedDocument("bomb.docx", zipBomb);
  assert.equal(bombRes.ok, false);
  if (!bombRes.ok) {
    assert.equal(bombRes.status, 413);
    assert.match(bombRes.error, /ratio|exceeds/i);
  }

  // 2. PDF FlateDecode decompression bomb
  const pdfBombCompressed = zlib.deflateSync(Buffer.alloc(150 * 1024, "B"));
  const pdfBombBuf = Buffer.concat([
    Buffer.from("%PDF-1.4\n1 0 obj\n<< /Filter /FlateDecode >>\nstream\n", "latin1"),
    pdfBombCompressed,
    Buffer.from("\nendstream\nendobj\n%%EOF", "latin1"),
  ]);
  const pdfBombRes = fileParserMod.parseUploadedDocument(
    "bomb.pdf",
    pdfBombBuf,
  );
  assert.equal(pdfBombRes.ok, false);
  if (!pdfBombRes.ok) {
    assert.equal(pdfBombRes.status, 413);
  }

  // 3. Path traversal in ZIP entry (`../../etc/passwd`)
  const traversalZip = buildLocalZipEntry({
    entryName: "../../etc/passwd",
    rawData: Buffer.from("root:x:0:0", "utf8"),
  });
  const traversalRes = fileParserMod.parseUploadedDocument(
    "evil.docx",
    traversalZip,
  );
  assert.equal(traversalRes.ok, false);
  if (!traversalRes.ok) {
    assert.equal(traversalRes.status, 400);
    assert.match(traversalRes.error, /traversal|unsafe/i);
  }

  // 4. Encrypted ZIP entry (flags bit 0 set)
  const encryptedZip = buildLocalZipEntry({
    entryName: "word/document.xml",
    rawData: Buffer.from("secret", "utf8"),
    flags: 0x01,
  });
  const encryptedRes = fileParserMod.parseUploadedDocument(
    "encrypted.docx",
    encryptedZip,
  );
  assert.equal(encryptedRes.ok, false);
  if (!encryptedRes.ok) {
    assert.equal(encryptedRes.status, 422);
    assert.match(encryptedRes.error, /encrypted/i);
  }

  // 5. Corrupt DEFLATE payload in ZIP
  const corruptHeader = Buffer.alloc(30);
  corruptHeader.writeUInt32LE(0x04034b50, 0);
  corruptHeader.writeUInt16LE(20, 4);
  corruptHeader.writeUInt16LE(0, 6);
  corruptHeader.writeUInt16LE(8, 8); // DEFLATE
  corruptHeader.writeUInt32LE(12, 18);
  corruptHeader.writeUInt32LE(24, 22);
  const entryNameBuf = Buffer.from("word/document.xml", "utf8");
  corruptHeader.writeUInt16LE(entryNameBuf.byteLength, 26);
  const corruptZip = Buffer.concat([
    corruptHeader,
    entryNameBuf,
    Buffer.from("not_deflate!", "utf8"),
  ]);
  const corruptRes = fileParserMod.parseUploadedDocument(
    "corrupt.docx",
    corruptZip,
  );
  assert.equal(corruptRes.ok, false);
  if (!corruptRes.ok) {
    assert.equal(corruptRes.status, 422);
  }
});
