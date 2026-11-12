import { NextRequest, NextResponse } from "next/server";
import { db, ensureDatabaseReady } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { readBoundedJsonBody, sanitizeText } from "@/lib/security";
import { getOrCreateRequestId, logger } from "@/lib/logger";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 16 * 1024;
const EMAIL_RE =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export async function POST(req: NextRequest) {
  const requestId = getOrCreateRequestId(req.headers);

  const rateLimit = await checkRateLimit(req.headers, {
    namespace: "api:subscribe",
    limit: 15,
    windowMs: 60_000,
  });

  const baseHeaders: Record<string, string> = {
    ...rateLimit.headers,
    "X-Request-Id": requestId,
  };

  if (!rateLimit.allowed) {
    logger.warn("subscribe.rate_limited", { requestId });
    return NextResponse.json(
      {
        ok: false,
        code: "RATE_LIMITED",
        error: "Too many submissions. Please try again in a minute.",
        requestId,
      },
      { status: 429, headers: baseHeaders },
    );
  }

  const bodyRes = await readBoundedJsonBody(req, MAX_REQUEST_BYTES);
  if (!bodyRes.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: bodyRes.code,
        error: bodyRes.error,
        requestId,
      },
      { status: bodyRes.status, headers: baseHeaders },
    );
  }

  const body = bodyRes.data;
  const email = sanitizeText(body?.email, 254).toLowerCase();
  const source = sanitizeText(body?.source, 64) || "hero";
  const name = sanitizeText(body?.name, 120) || undefined;
  const company = sanitizeText(body?.company, 120) || undefined;
  const role = sanitizeText(body?.role, 120) || undefined;

  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        error: "Please enter a valid email address.",
        requestId,
      },
      { status: 400, headers: baseHeaders },
    );
  }

  try {
    await ensureDatabaseReady();
    let alreadyRegistered = false;
    try {
      await db.waitlist.create({
        data: { email, name, source, company, role },
      });
    } catch (e) {
      if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
        alreadyRegistered = true;
      } else {
        throw e;
      }
    }

    const count = await db.waitlist.count();

    logger.info("subscribe.recorded", {
      requestId,
      email,
      source,
      alreadyRegistered,
    });

    if (alreadyRegistered) {
      return NextResponse.json(
        {
          ok: true,
          alreadyRegistered: true,
          count,
          message: "You're already on the list — we'll be in touch.",
          requestId,
        },
        { headers: baseHeaders },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        alreadyRegistered: false,
        count,
        message: "You're on the list. We'll reach out within one business day.",
        requestId,
      },
      { headers: baseHeaders },
    );
  } catch (err) {
    logger.error("subscribe.db_error", {
      requestId,
      error: err instanceof Error ? err.message : "Database write failed",
    });
    return NextResponse.json(
      {
        ok: false,
        code: "DATABASE_UNAVAILABLE",
        error:
          "Unable to record your registration right now. Please try again shortly.",
        requestId,
      },
      { status: 503, headers: baseHeaders },
    );
  }
}

export async function GET(req: NextRequest) {
  const requestId = getOrCreateRequestId(req?.headers);
  try {
    await ensureDatabaseReady();
    const count = await db.waitlist.count();
    return NextResponse.json(
      { ok: true, count, requestId },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "X-Request-Id": requestId,
        },
      },
    );
  } catch (err) {
    logger.error("subscribe.count_error", {
      requestId,
      error: err instanceof Error ? err.message : "Database count failed",
    });
    return NextResponse.json(
      {
        ok: false,
        code: "DATABASE_UNAVAILABLE",
        error: "Waitlist count is temporarily unavailable.",
        requestId,
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "X-Request-Id": requestId,
        },
      },
    );
  }
}
