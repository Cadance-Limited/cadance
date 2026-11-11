import crypto from "node:crypto";
const LEVEL_PRIORITY = {
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
function maskEmail(email) {
    const atIndex = email.indexOf("@");
    if (atIndex <= 1)
        return "***@***";
    const local = email.slice(0, atIndex);
    const domain = email.slice(atIndex + 1);
    return `${local[0]}***@${domain}`;
}
export function redactMetadata(value, depth = 0) {
    if (depth > 4)
        return "[Truncated]";
    if (value === null || value === undefined)
        return value;
    if (typeof value === "string") {
        if (value.length > 500) {
            return `${value.slice(0, 120)}...[Redacted ${value.length} chars]`;
        }
        return value;
    }
    if (typeof value !== "object")
        return value;
    if (Array.isArray(value)) {
        return value.slice(0, 10).map((item) => redactMetadata(item, depth + 1));
    }
    const out = {};
    for (const [k, v] of Object.entries(value)) {
        const lowerKey = k.toLowerCase();
        if (REDACTED_KEYS.has(lowerKey)) {
            out[k] = "[REDACTED]";
        }
        else if (lowerKey === "email" && typeof v === "string") {
            out[k] = maskEmail(v);
        }
        else {
            out[k] = redactMetadata(v, depth + 1);
        }
    }
    return out;
}
export function getOrCreateRequestId(headers) {
    const incoming = headers?.get("x-request-id")?.trim();
    if (incoming && /^[a-zA-Z0-9\-_]{8,64}$/.test(incoming)) {
        return incoming;
    }
    return `req_${crypto.randomBytes(8).toString("hex")}`;
}
function getConfiguredLevel() {
    const raw = (process.env.LOG_LEVEL ?? "info").toLowerCase();
    if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
        return raw;
    }
    return "info";
}
function emitLog(level, event, meta = {}) {
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
        ...redactMetadata(meta),
    };
    const line = JSON.stringify(payload);
    if (level === "error") {
        console.error(line);
    }
    else if (level === "warn") {
        console.warn(line);
    }
    else {
        console.log(line);
    }
}
export const logger = {
    debug: (event, meta) => emitLog("debug", event, meta),
    info: (event, meta) => emitLog("info", event, meta),
    warn: (event, meta) => emitLog("warn", event, meta),
    error: (event, meta) => emitLog("error", event, meta),
};
