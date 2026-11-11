import { NextRequest, NextResponse } from "next/server";
import { getZAI, withTimeout } from "@/lib/zai";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/security";
import {
  generateDeterministicChatResponse,
  type ChatTurn,
} from "@/lib/diagnostics-engine";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `You are Cadence, an AI operations analyst built for business (non-technical) teams.

Your job: diagnose operations problems from invoices, contracts, SOPs, and process data, then prescribe the next moves in plain English.

STYLE
- Talk like a sharp, calm senior analyst — not a chatbot. No emoji. No hype.
- Be concrete. Cite the numbers, fields, or clauses you're reacting to.
- Plain English. Avoid jargon. If you must use a term (e.g. "3-way match"), define it in one short clause.

REASONING (ALWAYS)
- Before answering, walk through the chain of reasoning in a short "Reasoning" section: the records you considered, the rules you applied, and the bottleneck you located. Use 3–5 tight bullets.
- Then give a "Prescription" section: a ranked, numbered list of the next 2–4 moves. For each move, include a one-line rationale and, when defensible, an estimate of hours/week recovered or risk reduced.
- End with a single "Open question" line — the one thing you'd ask the user next to sharpen the diagnosis.

FORMAT
- Use Markdown. Headings: ## Reasoning, ## Prescription, ## Open question.
- Keep total length under ~280 words. Tight beats long.
- Never invent fake statistics if the user has not provided data; if you don't have the data, say so and ask for it.`;

export async function POST(req: NextRequest) {
  const rateLimit = checkRateLimit(req.headers, {
    namespace: "api:chat",
    limit: 30,
    windowMs: 60_000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: "Rate limit exceeded. Please wait a moment before sending another question.",
      },
      { status: 429, headers: rateLimit.headers },
    );
  }

  try {
    const body = await req.json().catch(() => null);
    const rawMessages: unknown[] = Array.isArray(body?.messages)
      ? body.messages
      : [];

    const sanitized: ChatTurn[] = [];
    for (const item of rawMessages) {
      if (!item || typeof item !== "object") continue;
      const rec = item as Record<string, unknown>;
      const role = rec.role === "user" || rec.role === "assistant" ? rec.role : null;
      const content = sanitizeText(rec.content, 4000);
      if (role && content) {
        sanitized.push({ role, content });
      }
    }

    const lastUser = [...sanitized].reverse().find((m) => m.role === "user");
    if (!lastUser) {
      return NextResponse.json(
        { ok: false, error: "No user message provided." },
        { status: 400, headers: rateLimit.headers },
      );
    }

    // Keep the conversation tight — last 8 messages max.
    const trimmed = sanitized.slice(-8);

    try {
      const zai = await withTimeout(getZAI(), 8000, "Model initialization");
      const completion = await withTimeout(
        zai.chat.completions.create({
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...trimmed,
          ],
          thinking: { type: "disabled" },
        }),
        18000,
        "Diagnostic completion",
      );

      const content = completion?.choices?.[0]?.message?.content?.trim();
      if (content) {
        return NextResponse.json(
          { ok: true, content, mode: "live" },
          { headers: rateLimit.headers },
        );
      }
    } catch {
      // Fall through to deterministic diagnostic engine when ZAI SDK is unconfigured or unreachable
    }

    const fallbackContent = generateDeterministicChatResponse(trimmed);
    return NextResponse.json(
      { ok: true, content: fallbackContent, mode: "deterministic" },
      { headers: rateLimit.headers },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: `Cadence is unavailable right now — ${message}` },
      { status: 500, headers: rateLimit.headers },
    );
  }
}
