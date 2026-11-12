import crypto from "node:crypto";
import { db, ensureDatabaseReady } from "./db";

/**
 * Cryptographic authentication & multi-tenant session engine:
 * - Password hashing via Node's native `crypto.scryptSync` (N=16384, r=8, p=1, 64-byte key)
 *   with a unique 16-byte random salt and constant-time `crypto.timingSafeEqual` verification.
 * - Database-backed opaque session tokens (`cadence_session` HttpOnly cookie) hashed with SHA-256
 *   before storage so raw session tokens are never stored in the database.
 */

export const SESSION_COOKIE_NAME = "cadence_session";
const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto
    .scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 })
    .toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  try {
    const derived = crypto.scryptSync(password, salt, 64, {
      N: 16384,
      r: 8,
      p: 1,
    });
    const expectedBuf = Buffer.from(expectedHex, "hex");
    if (derived.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(derived, expectedBuf);
  } catch {
    return false;
  }
}

export function generateSessionToken(): { rawToken: string; tokenHash: string } {
  const rawToken = `cad_${crypto.randomBytes(32).toString("hex")}`;
  const tokenHash = hashSessionToken(rawToken);
  return { rawToken, tokenHash };
}

export function hashSessionToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export function extractSessionTokenFromHeaders(headers: Headers): string | null {
  const authHeader = headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }

  const cookieHeader = headers.get("cookie");
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [k, ...vParts] = part.trim().split("=");
    if (k === SESSION_COOKIE_NAME) {
      const val = vParts.join("=").trim();
      if (val) return decodeURIComponent(val);
    }
  }
  return null;
}

export function buildSessionCookieHeader(
  rawToken: string,
  maxAgeSec = Math.floor(SESSION_TTL_MS / 1000),
): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(rawToken)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure}`;
}

export function buildClearSessionCookieHeader(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export type AuthenticatedContext = {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
  };
  workspace: {
    id: string;
    name: string;
    slug: string;
    plan: string;
  };
  sessionId: string;
};

export async function getAuthenticatedSession(
  headers: Headers,
): Promise<AuthenticatedContext | null> {
  const rawToken = extractSessionTokenFromHeaders(headers);
  if (!rawToken || !rawToken.startsWith("cad_")) return null;

  try {
    await ensureDatabaseReady();
    const tokenHash = hashSessionToken(rawToken);
    const session = await db.session.findUnique({
      where: { tokenHash },
      include: {
        user: true,
        workspace: true,
      },
    });

    if (!session) return null;
    if (session.expiresAt.getTime() <= Date.now()) {
      await db.session.delete({ where: { id: session.id } }).catch(() => {});
      return null;
    }

    return {
      sessionId: session.id,
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role,
      },
      workspace: {
        id: session.workspace.id,
        name: session.workspace.name,
        slug: session.workspace.slug,
        plan: session.workspace.plan,
      },
    };
  } catch {
    return null;
  }
}

export function slugifyWorkspaceName(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  const suffix = crypto.randomBytes(3).toString("hex");
  return `${base || "workspace"}-${suffix}`;
}
