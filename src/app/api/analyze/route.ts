import { NextRequest, NextResponse } from "next/server";
import { getZAI, withTimeout } from "@/lib/zai";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizeText, validateExternalUrl } from "@/lib/security";
import {
  analyzeDocumentDeterministic,
  normalizeAnalysisPayload,
} from "@/lib/diagnostics-engine";

export const runtime = "nodejs";
export const maxDuration = 60;

type DocType = "invoice" | "contract" | "sop" | "auto";
const VALID_DOC_TYPES = new Set<DocType>(["invoice", "contract", "sop", "auto"]);

const EXTRACTION_SYSTEM = `You are Cadence, an AI operations analyst. You are given a single business document (an invoice, a contract, an SOP, or arbitrary text) and must extract a structured analysis.

RULES
- Respond with a single valid JSON object and NOTHING else — no prose, no code fences, no commentary.
- If a value is not present in the document, omit the field or set the value to null. Never fabricate data.
- keyFields: the 4–8 fields that actually matter for this document type (e.g. for an invoice: vendor, invoice number, issue date, due date, net terms, subtotal, tax, total, payment method). Mark flagged=true when a field looks unusual or risky, and add a short note explaining why.
- anomalies: 0–5 concrete issues (duplicate line items, terms that drift from norms, missing fields, suspicious math, outlier pricing). severity: low | medium | high.
- recommendations: 0–4 ranked next moves. rationale is one sentence. estHoursRecovered is a short string like "6.2 hrs/week" or null.

JSON SCHEMA
{
  "docType": "invoice" | "contract" | "sop" | "other",
  "summary": "string — 2-3 sentences on what this document is and its status",
  "keyFields": [{ "label": "string", "value": "string", "flagged": boolean, "note": "string?" }],
  "anomalies": [{ "title": "string", "severity": "low" | "medium" | "high", "note": "string" }],
  "recommendations": [{ "title": "string", "rationale": "string", "estHoursRecovered": "string | null" }]
}`;

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function tryParseJson(raw: string): Record<string, unknown> | null {
  if (!raw || typeof raw !== "string") return null;
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  const candidates = [
    raw,
    raw.replace(/```json\s*/i, "").replace(/```\s*$/i, ""),
    firstBrace !== -1 && lastBrace > firstBrace
      ? raw.slice(firstBrace, lastBrace + 1)
      : "",
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* continue */
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const rateLimit = checkRateLimit(req.headers, {
    namespace: "api:analyze",
    limit: 20,
    windowMs: 60_000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: "Rate limit exceeded. Please wait a moment before analyzing another document.",
      },
      { status: 429, headers: rateLimit.headers },
    );
  }

  try {
    const body = await req.json().catch(() => null);
    const rawUrl = typeof body?.url === "string" ? body.url.trim() : "";
    const rawText = sanitizeText(body?.text, 12000);
    const rawDocType = typeof body?.docType === "string" ? body.docType : "auto";
    const docType: DocType = VALID_DOC_TYPES.has(rawDocType as DocType)
      ? (rawDocType as DocType)
      : "auto";

    if (!rawUrl && !rawText) {
      return NextResponse.json(
        { ok: false, error: "Provide either a URL or document text." },
        { status: 400, headers: rateLimit.headers },
      );
    }

    let sourceTitle = "Pasted document";
    let sourceUrl: string | null = null;
    let publishedTime: string | null = null;
    let docText = "";

    if (rawUrl) {
      const urlCheck = validateExternalUrl(rawUrl);
      if (!urlCheck.ok) {
        return NextResponse.json(
          { ok: false, error: urlCheck.error },
          { status: 400, headers: rateLimit.headers },
        );
      }
      const safeUrl = urlCheck.url;
      sourceUrl = safeUrl;

      try {
        const zai = await withTimeout(getZAI(), 6000, "Reader init");
        const reader = await withTimeout(
          zai.functions.invoke("page_reader", { url: safeUrl }),
          12000,
          "Page reader",
        );
        const data = reader?.data;
        if (data?.html || data?.text) {
          sourceTitle = data.title || safeUrl;
          sourceUrl = data.url || safeUrl;
          publishedTime = data.publishedTime ?? null;
          docText = stripHtml(data.html || data.text || "").slice(0, 8000);
        }
      } catch {
        // Fallback to direct HTTP fetch if ZAI page_reader is unavailable
      }

      if (!docText) {
        try {
          const resp = await fetch(safeUrl, {
            headers: {
              "User-Agent": "Cadence-Document-Analyzer/1.0",
              Accept: "text/html,text/plain,application/xhtml+xml",
            },
            signal: AbortSignal.timeout(8000),
          });
          if (resp.ok) {
            const rawHtml = await resp.text();
            const titleMatch = rawHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
            sourceTitle = titleMatch?.[1]?.trim() || safeUrl;
            docText = stripHtml(rawHtml).slice(0, 8000);
          }
        } catch {
          /* handled below */
        }
      }

      if (!docText) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Couldn't read that page — it may be behind a paywall, login, or unavailable.",
          },
          { status: 502, headers: rateLimit.headers },
        );
      }
    } else {
      docText = rawText.slice(0, 8000);
    }

    if (!docText) {
      return NextResponse.json(
        { ok: false, error: "The document came back empty." },
        { status: 422, headers: rateLimit.headers },
      );
    }

    const userPrompt = `Document type hint: ${docType === "auto" ? "auto-detect" : docType}\n\nDOCUMENT:\n"""\n${docText}\n"""`;

    try {
      const zai = await withTimeout(getZAI(), 6000, "Model init");
      const completion = await withTimeout(
        zai.chat.completions.create({
          messages: [
            { role: "system", content: EXTRACTION_SYSTEM },
            { role: "user", content: userPrompt },
          ],
          thinking: { type: "disabled" },
        }),
        18000,
        "Document extraction",
      );

      const raw = completion?.choices?.[0]?.message?.content ?? "";
      const parsed = tryParseJson(raw);

      if (parsed) {
        const normalized = normalizeAnalysisPayload(parsed, docType);
        return NextResponse.json(
          {
            ok: true,
            ...normalized,
            source: { title: sourceTitle, url: sourceUrl, publishedTime },
          },
          { headers: rateLimit.headers },
        );
      }
    } catch {
      // Fall through to deterministic extraction engine
    }

    const deterministic = analyzeDocumentDeterministic(docText, docType);
    return NextResponse.json(
      {
        ok: true,
        ...deterministic,
        source: { title: sourceTitle, url: sourceUrl, publishedTime },
      },
      { headers: rateLimit.headers },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: `Document analysis failed — ${message}` },
      { status: 500, headers: rateLimit.headers },
    );
  }
}
