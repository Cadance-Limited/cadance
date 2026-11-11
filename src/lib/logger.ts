import crypto from "node:crypto";

/**
 * Structured server-side logger with correlation IDs and automatic redaction
 * of sensitive document contents, emails, tokens, and credentials.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const REDACTED_KEYS = new Set([
  "password",
  "token",
  "secret",
  "authorization",
  "cookie",
  "apikey",
  "api_key",
  "text",
  "doctext",
  "raw",
  "content",
  "messages",
]);

function maskEmail(email: string): string {
  const atIndex = email.indexOf("@");
  if (atIndex <= 1) return "***@***";
  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  return `${local[0]}***@${domain}`;
}

export function redactMetadata(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[Truncated]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    if (value.length > 500) {
      return `${value.slice(0, 120)}...[Redacted ${value.length} chars]`;
    }
    return value;
  }
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.slice(0, 10).map((item) => redactMetadata(item, depth + 1));
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const lowerKey = k.toLowerCase();
    if (REDACTED_KEYS.has(lowerKey)) {
      out[k] = "[REDACTED]";
    } else if (lowerKey === "email" && typeof v === "string") {
      out[k] = maskEmail(v);
    } else {
      out[k] = redactMetadata(v, depth + 1);
    }
  }
  return out;
}

export function getOrCreateRequestId(headers?: Headers): string {
  const incoming = headers?.get("x-request-id")?.trim();
  if (incoming && /^[a-zA-Z0-9\-_]{8,64}$/.test(incoming)) {
    return incoming;
  }
  return `req_${crypto.randomBytes(8).toString("hex")}`;
}

function getConfiguredLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }
  return "info";
}

function emitLog(
  level: LogLevel,
  event: string,
  meta: Record<string, unknown> = {},
) {
  if (process.env.NODE_ENV === "test" && process.env.ENABLE_TEST_LOGS !== "1") {
    return;
  }
  const minLevel = getConfiguredLevel();
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[minLevel]) {
    return;
  }

  const payload = {
    timestamp: new Date().toISOString(),
    level,
    service: "cadence-web",
    event,
    ...(redactMetadata(meta) as Record<string, unknown>),
  };

  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (event: string, meta?: Record<string, unknown>) =>
    emitLog("debug", event, meta),
  info: (event: string, meta?: Record<string, unknown>) =>
    emitLog("info", event, meta),
  warn: (event: string, meta?: Record<string, unknown>) =>
    emitLog("warn", event, meta),
  error: (event: string, meta?: Record<string, unknown>) =>
    emitLog("error", event, meta),
};
