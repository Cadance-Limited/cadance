/**
 * Security utilities for input sanitization and SSRF (Server-Side Request Forgery) protection.
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "0.0.0.0",
  "127.0.0.1",
  "::1",
  "[::1]",
  "169.254.169.254",
  "metadata.google.internal",
  "metadata",
]);

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".");
  if (parts.length !== 4) return false;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;

  const [a, b] = nums;
  // 0.0.0.0/8, 10.0.0.0/8, 127.0.0.0/8
  if (a === 0 || a === 10 || a === 127) return true;
  // 169.254.0.0/16 (link-local / cloud metadata)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12 (private network)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16 (private network)
  if (a === 192 && b === 168) return true;
  // 100.64.0.0/10 (carrier-grade NAT)
  if (a === 100 && b >= 64 && b <= 127) return true;

  return false;
}

function isPrivateIpv6(hostname: string): boolean {
  const clean = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (clean === "::1" || clean === "::") return true;
  if (clean.startsWith("fc") || clean.startsWith("fd")) return true; // Unique local
  if (clean.startsWith("fe80:")) return true; // Link-local
  return false;
}

export type UrlValidationResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * Validates that a user-supplied URL uses HTTP/HTTPS and does not target
 * internal, loopback, link-local, or cloud metadata endpoints.
 */
export function validateExternalUrl(raw: string): UrlValidationResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "Provide a valid URL." };
  }
  if (trimmed.length > 2048) {
    return { ok: false, error: "URL exceeds maximum length (2048 characters)." };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      ok: false,
      error: "Invalid URL format. Include http:// or https://.",
    };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      ok: false,
      error: "Only http:// and https:// URLs are supported.",
    };
  }

  if (parsed.username || parsed.password) {
    return {
      ok: false,
      error: "URLs with embedded credentials are not allowed.",
    };
  }

  const host = parsed.hostname.toLowerCase();
  if (
    BLOCKED_HOSTNAMES.has(host) ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".localhost") ||
    isPrivateIpv4(host) ||
    isPrivateIpv6(host)
  ) {
    return {
      ok: false,
      error: "URLs pointing to private or local networks are not allowed.",
    };
  }

  return { ok: true, url: parsed.toString() };
}

export function sanitizeText(input: unknown, maxLength = 8000): string {
  if (typeof input !== "string") return "";
  return input.replace(/\0/g, "").trim().slice(0, maxLength);
}
