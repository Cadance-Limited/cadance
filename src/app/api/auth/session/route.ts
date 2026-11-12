import { NextRequest, NextResponse } from "next/server";
import { db, ensureDatabaseReady } from "@/lib/db";
import {
  buildClearSessionCookieHeader,
  buildSessionCookieHeader,
  extractSessionTokenFromHeaders,
  generateSessionToken,
  getAuthenticatedSession,
  hashPassword,
  hashSessionToken,
  slugifyWorkspaceName,
  verifyPassword,
} from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/security";
import { getOrCreateRequestId, logger } from "@/lib/logger";

export const runtime = "nodejs";

const EMAIL_RE = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;
const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

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

  let body: Record<string, unknown> | null = null;
  try {
    const parsed = await req.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      body = parsed as Record<string, unknown>;
    }
  } catch {
    return NextResponse.json(
      {
        ok: false,
        code: "INVALID_JSON",
        error: "Request body must be valid JSON.",
        requestId,
      },
      { status: 400, headers: baseHeaders },
    );
  }

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

  try {
    await ensureDatabaseReady();

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

      const workspace = await db.workspace.create({
        data: {
          name: workspaceName,
          slug,
          plan: "STARTER",
        },
      });

      const user = await db.user.create({
        data: {
          email,
          name,
          passwordHash,
          role: "OWNER",
          workspaceId: workspace.id,
        },
      });

      await db.session.create({
        data: {
          tokenHash,
          userId: user.id,
          workspaceId: workspace.id,
          expiresAt,
        },
      });

      await db.auditLog.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          action: "auth.register",
          requestId,
        },
      });

      logger.info("auth.registered", {
        requestId,
        email,
        workspaceId: workspace.id,
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
          },
          workspace: {
            id: workspace.id,
            name: workspace.name,
            slug: workspace.slug,
            plan: workspace.plan,
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

    // Login path
    const user = await db.user.findUnique({
      where: { email },
      include: { workspace: true },
    });

    if (!user || !verifyPassword(password, user.passwordHash)) {
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

    await db.session.create({
      data: {
        tokenHash,
        userId: user.id,
        workspaceId: user.workspaceId,
        expiresAt,
      },
    });

    await db.auditLog.create({
      data: {
        workspaceId: user.workspaceId,
        userId: user.id,
        action: "auth.login",
        requestId,
      },
    });

    logger.info("auth.logged_in", {
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
      error: err instanceof Error ? err.message : "Auth failed",
    });
    return NextResponse.json(
      {
        ok: false,
        code: "DATABASE_UNAVAILABLE",
        error: "Authentication service is temporarily unavailable.",
        requestId,
      },
      { status: 503, headers: baseHeaders },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const requestId = getOrCreateRequestId(req?.headers);
  const rawToken = extractSessionTokenFromHeaders(req.headers);

  if (rawToken) {
    try {
      await ensureDatabaseReady();
      const tokenHash = hashSessionToken(rawToken);
      await db.session.deleteMany({ where: { tokenHash } });
    } catch {
      /* ignore if session already expired */
    }
  }

  return NextResponse.json(
    { ok: true, authenticated: false, requestId },
    {
      headers: {
        "X-Request-Id": requestId,
        "Set-Cookie": buildClearSessionCookieHeader(),
      },
    },
  );
}
