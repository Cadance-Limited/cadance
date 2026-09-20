import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const email: string = (body?.email ?? "").toString().trim().toLowerCase();
    const source: string = (body?.source ?? "hero").toString();
    const company: string | undefined = body?.company
      ? String(body.company).slice(0, 120)
      : undefined;
    const role: string | undefined = body?.role
      ? String(body.role).slice(0, 120)
      : undefined;

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json(
        { ok: false, error: "That email doesn't look right." },
        { status: 400 },
      );
    }

    try {
      await db.waitlist.create({
        data: { email, source, company, role },
      });
    } catch (e) {
      // Unique-constraint collision → already on the list. Treat as success.
      if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
        return NextResponse.json({
          ok: true,
          alreadyRegistered: true,
          message: "You're already on the list — we'll be in touch.",
        });
      }
      throw e;
    }

    return NextResponse.json({
      ok: true,
      message: "You're on the list. We'll reach out with access within 48 hours.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: `Couldn't capture that email — ${message}` },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const count = await db.waitlist.count();
    return NextResponse.json({ ok: true, count });
  } catch {
    return NextResponse.json({ ok: true, count: 0 });
  }
}
