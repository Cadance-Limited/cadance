import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateRequestId, logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const requestId = getOrCreateRequestId(req?.headers);
  const start = Date.now();
  let dbHealthy = false;

  try {
    await db.$queryRaw`SELECT 1`;
    dbHealthy = true;
  } catch (err) {
    logger.error("healthcheck.db_unreachable", {
      requestId,
      error: err instanceof Error ? err.message : "Database check failed",
    });
  }

  const status = dbHealthy ? 200 : 503;
  return NextResponse.json(
    {
      ok: dbHealthy,
      status: dbHealthy ? "healthy" : "degraded",
      service: "cadence-web",
      version: "1.0.0",
      checks: {
        database: dbHealthy ? "up" : "down",
      },
      requestId,
      latencyMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Request-Id": requestId,
      },
    },
  );
}

export async function HEAD(req: NextRequest) {
  const requestId = getOrCreateRequestId(req?.headers);
  try {
    await db.$queryRaw`SELECT 1`;
    return new NextResponse(null, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Request-Id": requestId,
      },
    });
  } catch {
    return new NextResponse(null, {
      status: 503,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Request-Id": requestId,
      },
    });
  }
}
