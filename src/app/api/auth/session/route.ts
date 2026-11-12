import { NextRequest, NextResponse } from "next/server";
import { db, ensureDatabaseReady } from "@/lib/db";
import {
  SESSION_TTL_MS,
  buildClearSessionCookieHeader,
  buildSessionCookieHeader,
  extractSessionTokenFromHeaders,
  generateSessionToken,
  getAuthenticatedSession,
  hashPassword,
  hashSessionToken,
  listRolePermissions,
  pruneExpiredSessions,
  revokeAllUserSessions,
  slugifyWorkspaceName,
  verifyPassword,
  verifyPasswordAgainstDummy,
} from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { readBoundedJsonBody, sanitizeText } from "@/lib/security";
import { getOrCreateRequestId, logger } from "@/lib/logger";

export const runtime = "nodejs";

const MAX_AUTH_REQUEST_BYTES = 16 * 1024;
const EMAIL_RE =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export async function GET(req: NextRequest) {
  const requestId = getOrCreateRequestId(req?.headers);
  const ctx = await getAuthenticatedSession(req.headers);

  if (!ctx) {
    return NextResponse.json(
      { ok: true, authenticated: false, requestId },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "X-Request-Id": requestId,
        },
      },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      authenticated: true,
      user: ctx.user,
      workspace: ctx.workspace,
      requestId,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Request-Id": requestId,
      },
    },
  );
}

export async function POST(req: NextRequest) {
  const requestId = getOrCreateRequestId(req.headers);
  const rateLimit = await checkRateLimit(req.headers, {
    namespace: "api:auth",
    limit: 12,
    windowMs: 60_000,
  });

  const baseHeaders: Record<string, string> = {
    ...rateLimit.headers,
    "X-Request-Id": requestId,
  };

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        code: "RATE_LIMITED",
        error: "Too many authentication attempts. Please wait a minute.",
        requestId,
      },
      { status: 429, headers: baseHeaders },
    );
  }

  const bodyRes = await readBoundedJsonBody(req, MAX_AUTH_REQUEST_BYTES);
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
  const action = body?.action === "register" ? "register" : "login";
  const email = sanitizeText(body?.email, 254).toLowerCase();
  const password = typeof body?.password === "string" ? body.password : "";
  const name = sanitizeText(body?.name, 120) || null;
  const workspaceName =
    sanitizeText(body?.workspaceName, 120) ||
    (name ? `${name}'s Workspace` : "Operations Workspace");

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        error: "Enter a valid work email address.",
        requestId,
      },
      { status: 400, headers: baseHeaders },
    );
  }

  if (password.length < 8 || password.length > 128) {
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        error: "Password must be between 8 and 128 characters.",
        requestId,
      },
      { status: 400, headers: baseHeaders },
    );
  }

  // Per-account brute-force protection independent of client IP
  const accountRateLimit = await checkRateLimit(req.headers, {
    namespace: "api:auth:account",
    limit: 8,
    windowMs: 15 * 60_000,
    principalId: email,
  });

  if (!accountRateLimit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        code: "ACCOUNT_LOCKED_TEMPORARILY",
        error:
          "Too many attempts for this account. Please wait 15 minutes before trying again.",
        requestId,
      },
      {
        status: 429,
        headers: { ...baseHeaders, ...accountRateLimit.headers },
      },
    );
  }

  try {
    await ensureDatabaseReady();
    await pruneExpiredSessions().catch(() => {});

    if (action === "register") {
      const existing = await db.user.findUnique({ where: { email } });
      if (existing) {
        return NextResponse.json(
          {
            ok: false,
            code: "EMAIL_EXISTS",
            error: "An account with this email already exists. Sign in instead.",
            requestId,
          },
          { status: 409, headers: baseHeaders },
        );
      }

      const passwordHash = hashPassword(password);
      const slug = slugifyWorkspaceName(workspaceName);
      const { rawToken, tokenHash } = generateSessionToken();
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

      let txResult: {
        workspace: { id: string; name: string; slug: string; plan: string };
        user: { id: string; email: string; name: string | null; role: string };
      };

      try {
        txResult = await db.$transaction(async (tx) => {
          const workspace = await tx.workspace.create({
            data: {
              name: workspaceName,
              slug,
              plan: "STARTER",
            },
          });

          const user = await tx.user.create({
            data: {
              email,
              name,
              passwordHash,
              role: "OWNER",
              workspaceId: workspace.id,
            },
          });

          await tx.workspaceMember.create({
            data: {
              workspaceId: workspace.id,
              userId: user.id,
              role: "OWNER",
            },
          });

          await tx.session.create({
            data: {
              tokenHash,
              userId: user.id,
              workspaceId: workspace.id,
              expiresAt,
            },
          });

          await tx.auditLog.create({
            data: {
              workspaceId: workspace.id,
              userId: user.id,
              action: "auth.register",
              requestId,
            },
          });

          return { workspace, user };
        });
      } catch (txErr) {
        if (
          txErr &&
          typeof txErr === "object" &&
          "code" in txErr &&
          (txErr as { code?: unknown }).code === "P2002"
        ) {
          return NextResponse.json(
            {
              ok: false,
              code: "EMAIL_EXISTS",
              error:
                "An account with this email already exists. Sign in instead.",
              requestId,
            },
            { status: 409, headers: baseHeaders },
          );
        }
        throw txErr;
      }

      logger.info("auth.registered", {
        requestId,
        email,
        workspaceId: txResult.workspace.id,
      });

      return NextResponse.json(
        {
          ok: true,
          authenticated: true,
          user: {
            id: txResult.user.id,
            email: txResult.user.email,
            name: txResult.user.name,
            role: "OWNER",
            permissions: listRolePermissions("OWNER"),
          },
          workspace: {
            id: txResult.workspace.id,
            name: txResult.workspace.name,
            slug: txResult.workspace.slug,
            plan: txResult.workspace.plan,
          },
          requestId,
        },
        {
          headers: {
            ...baseHeaders,
            "Set-Cookie": buildSessionCookieHeader(rawToken),
          },
        },
      );
    }

    // Login path with constant-time dummy scrypt comparison when user does not exist
    const user = await db.user.findUnique({
      where: { email },
      include: { workspace: true },
    });

    const passwordValid = user
      ? verifyPassword(password, user.passwordHash)
      : verifyPasswordAgainstDummy(password);

    if (!user || !passwordValid) {
      return NextResponse.json(
        {
          ok: false,
          code: "INVALID_CREDENTIALS",
          error: "Invalid email or password.",
          requestId,
        },
        { status: 401, headers: baseHeaders },
      );
    }

    const { rawToken, tokenHash } = generateSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await db.$transaction(async (tx) => {
      await tx.session.create({
        data: {
          tokenHash,
          userId: user.id,
          workspaceId: user.workspaceId,
          expiresAt,
        },
      });

      await tx.auditLog.create({
        data: {
          workspaceId: user.workspaceId,
          userId: user.id,
          action: "auth.login",
          requestId,
        },
      });
    });

    logger.info("auth.login_succeeded", {
      requestId,
      email,
      workspaceId: user.workspaceId,
    });

    return NextResponse.json(
      {
        ok: true,
        authenticated: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          permissions: listRolePermissions(user.role),
        },
        workspace: {
          id: user.workspace.id,
          name: user.workspace.name,
          slug: user.workspace.slug,
          plan: user.workspace.plan,
        },
        requestId,
      },
      {
        headers: {
          ...baseHeaders,
          "Set-Cookie": buildSessionCookieHeader(rawToken),
        },
      },
    );
  } catch (err) {
    logger.error("auth.error", {
      requestId,
      error: err instanceof Error ? err.message : "Authentication failure",
    });
    return NextResponse.json(
      {
        ok: false,
        code: "DATABASE_UNAVAILABLE",
        error: "Workspace authentication service is temporarily unavailable.",
        requestId,
      },
      { status: 503, headers: baseHeaders },
    );
  }
}

export async function PATCH(req: NextRequest) {
  const requestId = getOrCreateRequestId(req.headers);
  const ctx = await getAuthenticatedSession(req.headers);
  if (!ctx) {
    return NextResponse.json(
      {
        ok: false,
        code: "UNAUTHORIZED",
        error: "Sign in to update account security settings.",
        requestId,
      },
      { status: 401, headers: { "X-Request-Id": requestId } },
    );
  }

  const bodyRes = await readBoundedJsonBody(req, MAX_AUTH_REQUEST_BYTES);
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

  const currentPassword =
    typeof bodyRes.data.currentPassword === "string"
      ? bodyRes.data.currentPassword
      : "";
  const newPassword =
    typeof bodyRes.data.newPassword === "string"
      ? bodyRes.data.newPassword
      : "";

  if (newPassword.length < 8 || newPassword.length > 128) {
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        error: "New password must be between 8 and 128 characters.",
        requestId,
      },
      { status: 400, headers: { "X-Request-Id": requestId } },
    );
  }

  try {
    await ensureDatabaseReady();
    const userRecord = await db.user.findUnique({ where: { id: ctx.user.id } });
    if (
      !userRecord ||
      !verifyPassword(currentPassword, userRecord.passwordHash)
    ) {
      return NextResponse.json(
        {
          ok: false,
          code: "INVALID_CREDENTIALS",
          error: "Current password is incorrect.",
          requestId,
        },
        { status: 401, headers: { "X-Request-Id": requestId } },
      );
    }

    const nextHash = hashPassword(newPassword);
    await db.user.update({
      where: { id: ctx.user.id },
      data: { passwordHash: nextHash },
    });

    const revokedSessions = await revokeAllUserSessions(
      ctx.user.id,
      ctx.sessionId,
    );

    await db.auditLog.create({
      data: {
        workspaceId: ctx.workspace.id,
        userId: ctx.user.id,
        action: "auth.password_rotated",
        metadataJson: JSON.stringify({ revokedSessions }),
        requestId,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        revokedOtherSessions: revokedSessions,
        requestId,
      },
      { headers: { "X-Request-Id": requestId } },
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        code: "DATABASE_UNAVAILABLE",
        error: "Unable to rotate password right now.",
        requestId,
      },
      { status: 503, headers: { "X-Request-Id": requestId } },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const requestId = getOrCreateRequestId(req?.headers);
  const rawToken = extractSessionTokenFromHeaders(req.headers);

  let revokeAll = false;
  try {
    const url = new URL(req.url);
    if (url.searchParams.get("scope") === "all") {
      revokeAll = true;
    }
  } catch {
    /* ignore */
  }

  if (rawToken && rawToken.startsWith("cad_")) {
    try {
      await ensureDatabaseReady();
      if (revokeAll) {
        const ctx = await getAuthenticatedSession(req.headers);
        if (ctx) {
          const revoked = await revokeAllUserSessions(ctx.user.id);
          await db.auditLog.create({
            data: {
              workspaceId: ctx.workspace.id,
              userId: ctx.user.id,
              action: "auth.logout_all_sessions",
              metadataJson: JSON.stringify({ revoked }),
              requestId,
            },
          });
        }
      } else {
        const tokenHash = hashSessionToken(rawToken);
        await db.session.deleteMany({ where: { tokenHash } });
      }
    } catch {
      /* ignore cleanup errors on logout */
    }
  }

  return NextResponse.json(
    { ok: true, authenticated: false, revokedAll: revokeAll, requestId },
    {
      headers: {
        "Set-Cookie": buildClearSessionCookieHeader(),
        "X-Request-Id": requestId,
      },
    },
  );
}
