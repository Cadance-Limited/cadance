import { NextRequest, NextResponse } from "next/server";
import { getZAI } from "@/lib/zai";

export const runtime = "nodejs";
export const maxDuration = 60;

type DocType = "invoice" | "contract" | "sop" | "auto";

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

function tryParseJson(raw: string): unknown | null {
  // Try direct parse, then fenced, then greedy brace extraction.
  const attempts = [
    raw,
    raw.replace(/```json\s*/i, "").replace(/```\s*$/i, ""),
    raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1),
  ];
  for (const a of attempts) {
    try {
      return JSON.parse(a);
    } catch {
      /* keep trying */
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const url: string | undefined = body?.url;
    const text: string | undefined = body?.text;
    const docType: DocType = body?.docType ?? "auto";

    if (!url && !text) {
      return NextResponse.json(
        { ok: false, error: "Provide either a URL or document text." },
        { status: 400 },
      );
    }

    const zai = await getZAI();

    let sourceTitle = "Pasted document";
    let sourceUrl: string | null = null;
    let publishedTime: string | null = null;
    let docText = "";

    if (url) {
      const reader = await zai.functions.invoke("page_reader", { url });
      const data = reader?.data;
      if (!data?.html && !data?.text) {
        return NextResponse.json(
          { ok: false, error: "Couldn't read that page — it may be behind a paywall or login." },
          { status: 502 },
        );
      }
      sourceTitle = data.title || sourceTitle;
      sourceUrl = data.url || url;
      publishedTime = data.publishedTime ?? null;
      docText = stripHtml(data.html || data.text || "").slice(0, 8000);
    } else if (text) {
      docText = text.slice(0, 8000);
    }

    if (!docText) {
      return NextResponse.json(
        { ok: false, error: "The document came back empty." },
        { status: 422 },
      );
    }

    const userPrompt = `Document type hint: ${docType === "auto" ? "auto-detect" : docType}\n\nDOCUMENT:\n"""\n${docText}\n"""`;

    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: EXTRACTION_SYSTEM },
        { role: "user", content: userPrompt },
      ],
      thinking: { type: "disabled" },
    });

    const raw = completion?.choices?.[0]?.message?.content ?? "";
    const parsed = tryParseJson(raw);

    if (!parsed || typeof parsed !== "object") {
      // Fallback — return a minimal payload plus the raw text so the UI stays useful.
      return NextResponse.json({
        ok: true,
        fallback: true,
        docType: docType === "auto" ? "other" : docType,
        summary:
          "Cadence read the document but couldn't structure it cleanly. The raw model output is attached.",
        keyFields: [],
        anomalies: [],
        recommendations: [],
        source: { title: sourceTitle, url: sourceUrl, publishedTime },
        raw,
      });
    }

    return NextResponse.json({
      ok: true,
      ...(parsed as Record<string, unknown>),
      source: { title: sourceTitle, url: sourceUrl, publishedTime },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: `Document analysis failed — ${message}` },
      { status: 500 },
    );
  }
}
