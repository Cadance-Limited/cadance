import { NextRequest, NextResponse } from "next/server";
import { getZAI } from "@/lib/zai";

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

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const messages: ChatMessage[] = Array.isArray(body?.messages)
      ? body.messages
      : [];

    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) {
      return NextResponse.json(
        { ok: false, error: "No user message provided." },
        { status: 400 },
      );
    }

    // Keep the conversation tight — last 8 messages max.
    const trimmed = messages.slice(-8);

    const zai = await getZAI();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: SYSTEM_PROMPT },
        ...trimmed,
      ],
      thinking: { type: "disabled" },
    });

    const content = completion?.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return NextResponse.json(
        { ok: false, error: "The analyst returned an empty response." },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, content });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: `Cadence is unavailable right now — ${message}` },
      { status: 500 },
    );
  }
}
