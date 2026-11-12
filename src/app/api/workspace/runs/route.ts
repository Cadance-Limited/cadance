import { NextRequest, NextResponse } from "next/server";
import { db, ensureDatabaseReady } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth";
import { getOrCreateRequestId, logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const requestId = getOrCreateRequestId(req?.headers);
  const ctx = await getAuthenticatedSession(req.headers);

  if (!ctx) {
    return NextResponse.json(
      {
        ok: false,
        code: "UNAUTHORIZED",
        error: "Sign in to your workspace to view saved diagnostic runs.",
        requestId,
      },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "X-Request-Id": requestId,
        },
      },
    );
  }

  try {
    await ensureDatabaseReady();
    const [runs, auditLogs] = await Promise.all([
      db.diagnosticRun.findMany({
        where: { workspaceId: ctx.workspace.id },
        orderBy: { createdAt: "desc" },
        take: 25,
      }),
      db.auditLog.findMany({
        where: { workspaceId: ctx.workspace.id },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    return NextResponse.json(
      {
        ok: true,
        workspace: ctx.workspace,
        runs: runs.map((r) => ({
          id: r.id,
          runType: r.runType,
          docType: r.docType,
          sourceTitle: r.sourceTitle,
          sourceUrl: r.sourceUrl,
          mode: r.mode,
          summary: r.summary,
          createdAt: r.createdAt,
        })),
        auditLogs: auditLogs.map((a) => ({
          id: a.id,
          action: a.action,
          requestId: a.requestId,
          createdAt: a.createdAt,
        })),
        requestId,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "X-Request-Id": requestId,
        },
      },
    );
  } catch (err) {
    logger.error("workspace.runs_fetch_failed", {
      requestId,
      workspaceId: ctx.workspace.id,
      error: err instanceof Error ? err.message : "Query error",
    });
    return NextResponse.json(
      {
        ok: false,
        code: "DATABASE_UNAVAILABLE",
        error: "Unable to load workspace history right now.",
        requestId,
      },
      { status: 503, headers: { "X-Request-Id": requestId } },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const requestId = getOrCreateRequestId(req?.headers);
  const ctx = await getAuthenticatedSession(req.headers);

  if (!ctx) {
    return NextResponse.json(
      {
        ok: false,
        code: "UNAUTHORIZED",
        error: "Sign in to manage workspace diagnostic runs.",
        requestId,
      },
      { status: 401, headers: { "X-Request-Id": requestId } },
    );
  }

  let runId = "";
  try {
    const body = await req.json();
    runId = typeof body?.runId === "string" ? body.runId.trim() : "";
  } catch {
    /* ignore */
  }

  if (!runId) {
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        error: "Provide a valid runId to delete.",
        requestId,
      },
      { status: 400, headers: { "X-Request-Id": requestId } },
    );
  }

  try {
    await ensureDatabaseReady();
    // Enforce tenant isolation: delete only if workspaceId matches the authenticated session
    const deleted = await db.diagnosticRun.deleteMany({
      where: {
        id: runId,
        workspaceId: ctx.workspace.id,
      },
    });

    if (deleted.count > 0) {
      await db.auditLog.create({
        data: {
          workspaceId: ctx.workspace.id,
          userId: ctx.user.id,
          action: "diagnostic_run.deleted",
          metadataJson: JSON.stringify({ runId }),
          requestId,
        },
      });
    }

    return NextResponse.json(
      { ok: true, deletedCount: deleted.count, requestId },
      { headers: { "X-Request-Id": requestId } },
    );
  } catch (err) {
    logger.error("workspace.run_delete_failed", {
      requestId,
      workspaceId: ctx.workspace.id,
      error: err instanceof Error ? err.message : "Delete error",
    });
    return NextResponse.json(
      {
        ok: false,
        code: "DATABASE_UNAVAILABLE",
        error: "Unable to delete diagnostic run.",
        requestId,
      },
      { status: 503, headers: { "X-Request-Id": requestId } },
    );
  }
}
