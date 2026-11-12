import { NextRequest, NextResponse } from "next/server";
import { db, ensureDatabaseReady } from "@/lib/db";
import {
  getAuthenticatedSession,
  hasWorkspacePermission,
} from "@/lib/auth";
import { readBoundedJsonBody } from "@/lib/security";
import { getOrCreateRequestId, logger } from "@/lib/logger";

export const runtime = "nodejs";

const MAX_DELETE_BODY_BYTES = 16 * 1024;

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

  if (!hasWorkspacePermission(ctx.user.role, "runs:read")) {
    return NextResponse.json(
      {
        ok: false,
        code: "FORBIDDEN",
        error: "Your workspace role does not permit viewing diagnostic runs.",
        requestId,
      },
      { status: 403, headers: { "X-Request-Id": requestId } },
    );
  }

  const canReadAudit = hasWorkspacePermission(ctx.user.role, "audit:read");

  try {
    await ensureDatabaseReady();
    const [runs, auditLogs] = await Promise.all([
      db.diagnosticRun.findMany({
        where: { workspaceId: ctx.workspace.id },
        orderBy: { createdAt: "desc" },
        take: 25,
      }),
      canReadAudit
        ? db.auditLog.findMany({
            where: { workspaceId: ctx.workspace.id },
            orderBy: { createdAt: "desc" },
            take: 20,
          })
        : Promise.resolve([]),
    ]);

    return NextResponse.json(
      {
        ok: true,
        workspace: ctx.workspace,
        role: ctx.user.role,
        permissions: ctx.user.permissions,
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

  if (!hasWorkspacePermission(ctx.user.role, "runs:delete")) {
    return NextResponse.json(
      {
        ok: false,
        code: "FORBIDDEN",
        error:
          "Only workspace OWNER or ADMIN roles can delete saved diagnostic runs.",
        requestId,
      },
      { status: 403, headers: { "X-Request-Id": requestId } },
    );
  }

  const bodyRes = await readBoundedJsonBody(req, MAX_DELETE_BODY_BYTES);
  if (!bodyRes.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: bodyRes.code,
        error: bodyRes.error,
        requestId,
      },
      { status: bodyRes.status, headers: { "X-Request-Id": requestId } },
    );
  }

  const runId =
    typeof bodyRes.data.runId === "string" ? bodyRes.data.runId.trim() : "";

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
