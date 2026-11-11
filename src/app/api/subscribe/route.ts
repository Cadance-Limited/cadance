import { NextRequest, NextResponse } from "next/server";
import { db, fallbackWaitlist } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/security";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const BASE_WAITLIST_COUNT = 412;

async function getTotalCount(): Promise<number> {
  try {
    const dbCount = await db.waitlist.count();
    return BASE_WAITLIST_COUNT + dbCount + fallbackWaitlist.size;
  } catch {
    return BASE_WAITLIST_COUNT + fallbackWaitlist.size;
  }
}

export async function POST(req: NextRequest) {
  const rateLimit = checkRateLimit(req.headers, {
    namespace: "api:subscribe",
    limit: 15,
    windowMs: 60_000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: "Too many submissions. Please try again in a minute.",
      },
      { status: 429, headers: rateLimit.headers },
    );
  }

  try {
    const body = await req.json().catch(() => null);
    const email = sanitizeText(body?.email, 254).toLowerCase();
    const source = sanitizeText(body?.source, 64) || "hero";
    const company = sanitizeText(body?.company, 120) || undefined;
    const name = sanitizeText(body?.name, 120) || undefined;
    const rawRole = sanitizeText(body?.role, 120) || undefined;
    const role =
      name && rawRole
        ? `${name} (${rawRole})`.slice(0, 120)
        : name || rawRole;

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json(
        { ok: false, error: "That email doesn't look right." },
        { status: 400, headers: rateLimit.headers },
      );
    }

    let alreadyRegistered = false;

    try {
      await db.waitlist.create({
        data: { email, source, company, role },
      });
    } catch (e) {
      if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
        alreadyRegistered = true;
      } else {
        // Fallback to in-memory registry if SQLite is mounted read-only
        if (fallbackWaitlist.has(email)) {
          alreadyRegistered = true;
        } else {
          fallbackWaitlist.set(email, {
            email,
            source,
            company,
            role,
            createdAt: new Date(),
          });
        }
      }
    }

    const count = await getTotalCount();

    if (alreadyRegistered) {
      return NextResponse.json(
        {
          ok: true,
          alreadyRegistered: true,
          count,
          message: "You're already on the list — we'll be in touch.",
        },
        { headers: rateLimit.headers },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        count,
        message:
          "You're on the list. We'll reach out with access within 48 hours.",
      },
      { headers: rateLimit.headers },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: `Couldn't capture that email — ${message}` },
      { status: 500, headers: rateLimit.headers },
    );
  }
}

export async function GET() {
  const count = await getTotalCount();
  return NextResponse.json(
    { ok: true, count },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
