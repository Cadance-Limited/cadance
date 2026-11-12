import { NextRequest, NextResponse } from "next/server";
import { db, ensureDatabaseReady } from "@/lib/db";
import {
  type WorkspaceRole,
  getAuthenticatedSession,
  hasWorkspacePermission,
  hashPassword,
  normalizeWorkspaceRole,
} from "@/lib/auth";
import { readBoundedJsonBody, sanitizeText } from "@/lib/security";
import { getOrCreateRequestId, logger } from "@/lib/logger";

export const runtime = "nodejs";

const MAX_MEMBER_BODY_BYTES = 16 * 1024;
const EMAIL_RE =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;
const VALID_ROLES = new Set<WorkspaceRole>([
  "OWNER",
  "ADMIN",
  "MEMBER",
  "VIEWER",
]);

export async function GET(req: NextRequest) {
  const requestId = getOrCreateRequestId(req?.headers);
  const ctx = await getAuthenticatedSession(req.headers);

  if (!ctx) {
    return NextResponse.json(
      {
        ok: false,
        code: "UNAUTHORIZED",
        error: "Sign in to view workspace members.",
        requestId,
      },
      { status: 401, headers: { "X-Request-Id": requestId } },
    );
  }

  if (!hasWorkspacePermission(ctx.user.role, "members:read")) {
    return NextResponse.json(
      {
        ok: false,
        code: "FORBIDDEN",
        error: "Your role does not permit viewing workspace members.",
        requestId,
      },
      { status: 403, headers: { "X-Request-Id": requestId } },
    );
  }

  try {
    await ensureDatabaseReady();
    const memberships = await db.workspaceMember.findMany({
      where: { workspaceId: ctx.workspace.id },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(
      {
        ok: true,
        workspaceId: ctx.workspace.id,
        members: memberships.map((m) => ({
          id: m.id,
          userId: m.userId,
          email: m.user.email,
          name: m.user.name,
          role: normalizeWorkspaceRole(m.role),
          createdAt: m.createdAt,
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
    logger.error("workspace.members_list_failed", {
      requestId,
      workspaceId: ctx.workspace.id,
      error: err instanceof Error ? err.message : "Query error",
    });
    return NextResponse.json(
      {
        ok: false,
        code: "DATABASE_UNAVAILABLE",
        error: "Unable to load workspace members.",
        requestId,
      },
      { status: 503, headers: { "X-Request-Id": requestId } },
    );
  }
}

export async function POST(req: NextRequest) {
  const requestId = getOrCreateRequestId(req?.headers);
  const ctx = await getAuthenticatedSession(req.headers);

  if (!ctx) {
    return NextResponse.json(
      {
        ok: false,
        code: "UNAUTHORIZED",
        error: "Sign in to manage workspace members.",
        requestId,
      },
      { status: 401, headers: { "X-Request-Id": requestId } },
    );
  }

  if (!hasWorkspacePermission(ctx.user.role, "members:manage")) {
    return NextResponse.json(
      {
        ok: false,
        code: "FORBIDDEN",
        error: "Only workspace OWNER or ADMIN roles can add members.",
        requestId,
      },
      { status: 403, headers: { "X-Request-Id": requestId } },
    );
  }

  const bodyRes = await readBoundedJsonBody(req, MAX_MEMBER_BODY_BYTES);
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

  const email = sanitizeText(bodyRes.data.email, 254).toLowerCase();
  const name = sanitizeText(bodyRes.data.name, 120) || null;
  const rawRole =
    typeof bodyRes.data.role === "string"
      ? bodyRes.data.role.trim().toUpperCase()
      : "MEMBER";
  const initialPassword =
    typeof bodyRes.data.password === "string" &&
    bodyRes.data.password.length >= 8
      ? bodyRes.data.password
      : "CadenceTempPass#2026";

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        error: "Provide a valid member email address.",
        requestId,
      },
      { status: 400, headers: { "X-Request-Id": requestId } },
    );
  }

  if (!VALID_ROLES.has(rawRole as WorkspaceRole)) {
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        error: "Role must be one of: OWNER, ADMIN, MEMBER, VIEWER.",
        requestId,
      },
      { status: 400, headers: { "X-Request-Id": requestId } },
    );
  }

  const targetRole = rawRole as WorkspaceRole;
  if (targetRole === "OWNER" && ctx.user.role !== "OWNER") {
    return NextResponse.json(
      {
        ok: false,
        code: "FORBIDDEN",
        error: "Only an existing workspace OWNER can grant the OWNER role.",
        requestId,
      },
      { status: 403, headers: { "X-Request-Id": requestId } },
    );
  }

  try {
    await ensureDatabaseReady();

    const memberRecord = await db.$transaction(async (tx) => {
      let targetUser = await tx.user.findUnique({ where: { email } });
      if (!targetUser) {
        targetUser = await tx.user.create({
          data: {
            email,
            name,
            passwordHash: hashPassword(initialPassword),
            role: targetRole,
            workspaceId: ctx.workspace.id,
          },
        });
      }

      const membership = await tx.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: ctx.workspace.id,
            userId: targetUser.id,
          },
        },
        update: { role: targetRole },
        create: {
          workspaceId: ctx.workspace.id,
          userId: targetUser.id,
          role: targetRole,
        },
      });

      await tx.auditLog.create({
        data: {
          workspaceId: ctx.workspace.id,
          userId: ctx.user.id,
          action: "workspace.member_upserted",
          metadataJson: JSON.stringify({
            memberUserId: targetUser.id,
            email: targetUser.email,
            role: targetRole,
          }),
          requestId,
        },
      });

      return {
        id: membership.id,
        userId: targetUser.id,
        email: targetUser.email,
        name: targetUser.name,
        role: targetRole,
      };
    });

    return NextResponse.json(
      {
        ok: true,
        member: memberRecord,
        requestId,
      },
      { headers: { "X-Request-Id": requestId } },
    );
  } catch (err) {
    logger.error("workspace.member_add_failed", {
      requestId,
      workspaceId: ctx.workspace.id,
      error: err instanceof Error ? err.message : "Member upsert error",
    });
    return NextResponse.json(
      {
        ok: false,
        code: "DATABASE_UNAVAILABLE",
        error: "Unable to add or update workspace member.",
        requestId,
      },
      { status: 503, headers: { "X-Request-Id": requestId } },
    );
  }
}

export async function PATCH(req: NextRequest) {
  const requestId = getOrCreateRequestId(req?.headers);
  const ctx = await getAuthenticatedSession(req.headers);

  if (!ctx) {
    return NextResponse.json(
      {
        ok: false,
        code: "UNAUTHORIZED",
        error: "Sign in to manage workspace roles.",
        requestId,
      },
      { status: 401, headers: { "X-Request-Id": requestId } },
    );
  }

  if (!hasWorkspacePermission(ctx.user.role, "members:manage")) {
    return NextResponse.json(
      {
        ok: false,
        code: "FORBIDDEN",
        error: "Only workspace OWNER or ADMIN roles can modify member roles.",
        requestId,
      },
      { status: 403, headers: { "X-Request-Id": requestId } },
    );
  }

  const bodyRes = await readBoundedJsonBody(req, MAX_MEMBER_BODY_BYTES);
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

  const userId =
    typeof bodyRes.data.userId === "string" ? bodyRes.data.userId.trim() : "";
  const rawRole =
    typeof bodyRes.data.role === "string"
      ? bodyRes.data.role.trim().toUpperCase()
      : "";

  if (!userId || !VALID_ROLES.has(rawRole as WorkspaceRole)) {
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        error:
          "Provide a valid userId and role (OWNER, ADMIN, MEMBER, VIEWER).",
        requestId,
      },
      { status: 400, headers: { "X-Request-Id": requestId } },
    );
  }

  const nextRole = rawRole as WorkspaceRole;
  if (nextRole === "OWNER" && ctx.user.role !== "OWNER") {
    return NextResponse.json(
      {
        ok: false,
        code: "FORBIDDEN",
        error: "Only an existing workspace OWNER can grant the OWNER role.",
        requestId,
      },
      { status: 403, headers: { "X-Request-Id": requestId } },
    );
  }

  try {
    await ensureDatabaseReady();
    const existing = await db.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: ctx.workspace.id,
          userId,
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        {
          ok: false,
          code: "NOT_FOUND",
          error: "Member not found in this workspace.",
          requestId,
        },
        { status: 404, headers: { "X-Request-Id": requestId } },
      );
    }

    if (existing.role === "OWNER" && nextRole !== "OWNER") {
      const ownerCount = await db.workspaceMember.count({
        where: { workspaceId: ctx.workspace.id, role: "OWNER" },
      });
      if (ownerCount <= 1) {
        return NextResponse.json(
          {
            ok: false,
            code: "LAST_OWNER_PROTECTED",
            error: "Cannot demote the sole OWNER of a workspace.",
            requestId,
          },
          { status: 400, headers: { "X-Request-Id": requestId } },
        );
      }
    }

    const updated = await db.$transaction(async (tx) => {
      const m = await tx.workspaceMember.update({
        where: {
          workspaceId_userId: {
            workspaceId: ctx.workspace.id,
            userId,
          },
        },
        data: { role: nextRole },
      });

      await tx.user.updateMany({
        where: { id: userId, workspaceId: ctx.workspace.id },
        data: { role: nextRole },
      });

      await tx.auditLog.create({
        data: {
          workspaceId: ctx.workspace.id,
          userId: ctx.user.id,
          action: "workspace.member_role_updated",
          metadataJson: JSON.stringify({ targetUserId: userId, nextRole }),
          requestId,
        },
      });

      return m;
    });

    return NextResponse.json(
      {
        ok: true,
        member: {
          id: updated.id,
          userId: updated.userId,
          role: updated.role,
        },
        requestId,
      },
      { headers: { "X-Request-Id": requestId } },
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        code: "DATABASE_UNAVAILABLE",
        error: "Unable to update member role.",
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
        error: "Sign in to manage workspace members.",
        requestId,
      },
      { status: 401, headers: { "X-Request-Id": requestId } },
    );
  }

  if (!hasWorkspacePermission(ctx.user.role, "members:manage")) {
    return NextResponse.json(
      {
        ok: false,
        code: "FORBIDDEN",
        error: "Only workspace OWNER or ADMIN roles can remove members.",
        requestId,
      },
      { status: 403, headers: { "X-Request-Id": requestId } },
    );
  }

  const bodyRes = await readBoundedJsonBody(req, MAX_MEMBER_BODY_BYTES);
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

  const userId =
    typeof bodyRes.data.userId === "string" ? bodyRes.data.userId.trim() : "";
  if (!userId) {
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        error: "Provide a valid userId to remove.",
        requestId,
      },
      { status: 400, headers: { "X-Request-Id": requestId } },
    );
  }

  try {
    await ensureDatabaseReady();
    const existing = await db.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: ctx.workspace.id,
          userId,
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        {
          ok: false,
          code: "NOT_FOUND",
          error: "Member not found in this workspace.",
          requestId,
        },
        { status: 404, headers: { "X-Request-Id": requestId } },
      );
    }

    if (existing.role === "OWNER") {
      const ownerCount = await db.workspaceMember.count({
        where: { workspaceId: ctx.workspace.id, role: "OWNER" },
      });
      if (ownerCount <= 1) {
        return NextResponse.json(
          {
            ok: false,
            code: "LAST_OWNER_PROTECTED",
            error: "Cannot remove the sole OWNER of a workspace.",
            requestId,
          },
          { status: 400, headers: { "X-Request-Id": requestId } },
        );
      }
    }

    await db.$transaction(async (tx) => {
      await tx.workspaceMember.delete({
        where: {
          workspaceId_userId: {
            workspaceId: ctx.workspace.id,
            userId,
          },
        },
      });

      await tx.session.deleteMany({
        where: {
          workspaceId: ctx.workspace.id,
          userId,
        },
      });

      await tx.auditLog.create({
        data: {
          workspaceId: ctx.workspace.id,
          userId: ctx.user.id,
          action: "workspace.member_removed",
          metadataJson: JSON.stringify({ removedUserId: userId }),
          requestId,
        },
      });
    });

    return NextResponse.json(
      { ok: true, removedUserId: userId, requestId },
      { headers: { "X-Request-Id": requestId } },
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        code: "DATABASE_UNAVAILABLE",
        error: "Unable to remove workspace member.",
        requestId,
      },
      { status: 503, headers: { "X-Request-Id": requestId } },
    );
  }
}
