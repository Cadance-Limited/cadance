import crypto from "node:crypto";
import { db, ensureDatabaseReady } from "./db";

/**
 * Cryptographic authentication, account-lifecycle & multi-tenant RBAC engine:
 * - Password hashing via Node's native `crypto.scryptSync` (N=16384, r=8, p=1, 64-byte key)
 *   with a unique 16-byte random salt and constant-time `crypto.timingSafeEqual` verification.
 * - Constant-time dummy scrypt comparison (`verifyPasswordAgainstDummy`) when an email does not
 *   exist, preventing timing-based user enumeration.
 * - Database-backed opaque session tokens (`cadence_session` HttpOnly cookie) hashed with SHA-256
 *   before storage, with session rotation and global revocation (`revokeAllUserSessions`).
 * - Role-Based Access Control (RBAC) across `OWNER`, `ADMIN`, `MEMBER`, and `VIEWER` roles backed
 *   by the `WorkspaceMember` join table.
 */

export const SESSION_COOKIE_NAME = "cadence_session";
export const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

export type WorkspacePermission =
  | "runs:read"
  | "runs:write"
  | "runs:delete"
  | "audit:read"
  | "members:read"
  | "members:manage"
  | "workspace:manage";

const ROLE_PERMISSIONS: Record<WorkspaceRole, ReadonlySet<WorkspacePermission>> = {
  VIEWER: new Set<WorkspacePermission>(["runs:read", "members:read"]),
  MEMBER: new Set<WorkspacePermission>([
    "runs:read",
    "runs:write",
    "members:read",
  ]),
  ADMIN: new Set<WorkspacePermission>([
    "runs:read",
    "runs:write",
    "runs:delete",
    "audit:read",
    "members:read",
    "members:manage",
  ]),
  OWNER: new Set<WorkspacePermission>([
    "runs:read",
    "runs:write",
    "runs:delete",
    "audit:read",
    "members:read",
    "members:manage",
    "workspace:manage",
  ]),
};

export function normalizeWorkspaceRole(raw: unknown): WorkspaceRole {
  if (typeof raw !== "string") return "MEMBER";
  const upper = raw.trim().toUpperCase();
  if (
    upper === "OWNER" ||
    upper === "ADMIN" ||
    upper === "MEMBER" ||
    upper === "VIEWER"
  ) {
    return upper;
  }
  return "MEMBER";
}

export function hasWorkspacePermission(
  role: unknown,
  permission: WorkspacePermission,
): boolean {
  const normalized = normalizeWorkspaceRole(role);
  return ROLE_PERMISSIONS[normalized].has(permission);
}

export function listRolePermissions(role: unknown): WorkspacePermission[] {
  const normalized = normalizeWorkspaceRole(role);
  return Array.from(ROLE_PERMISSIONS[normalized]);
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto
    .scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 })
    .toString("hex");
  return `scrypt$${salt}$${derived}`;
}

// Precomputed dummy scrypt hash used when an email is not found during login to prevent timing enumeration
const DUMMY_PASSWORD_HASH = hashPassword("cadence-dummy-timing-guard-secret");

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

export function verifyPasswordAgainstDummy(password: string): false {
  verifyPassword(password, DUMMY_PASSWORD_HASH);
  return false;
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
    role: WorkspaceRole;
    permissions: WorkspacePermission[];
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

    // Resolve authoritative workspace role from WorkspaceMember join table first, falling back to user.role
    let resolvedRole: WorkspaceRole = normalizeWorkspaceRole(session.user.role);
    try {
      const membership = await db.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: session.workspaceId,
            userId: session.userId,
          },
        },
      });
      if (membership?.role) {
        resolvedRole = normalizeWorkspaceRole(membership.role);
      } else if (session.user.workspaceId !== session.workspaceId) {
        // User is not a member of this session's target workspace
        return null;
      }
    } catch {
      /* fallback to session.user.role */
    }

    return {
      sessionId: session.id,
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: resolvedRole,
        permissions: listRolePermissions(resolvedRole),
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

export async function revokeAllUserSessions(
  userId: string,
  exceptSessionId?: string,
): Promise<number> {
  await ensureDatabaseReady();
  const res = await db.session.deleteMany({
    where: exceptSessionId
      ? { userId, id: { not: exceptSessionId } }
      : { userId },
  });
  return res.count;
}

export async function pruneExpiredSessions(): Promise<number> {
  await ensureDatabaseReady();
  const res = await db.session.deleteMany({
    where: { expiresAt: { lte: new Date() } },
  });
  return res.count;
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
