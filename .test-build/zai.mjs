import ZAI from "./mock-zai-sdk.mjs";
import { logger } from "./logger.mjs";
/**
 * Shared ZAI singleton for backend-only usage.
 * Resets cached promise on initialization failure and supports bounded retries
 * with exponential backoff + jitter for transient provider errors.
 */
let zaiPromise = null;
export function getZAI() {
    if (!zaiPromise) {
        zaiPromise = ZAI.create().catch((err) => {
            zaiPromise = null;
            throw err;
        });
    }
    return zaiPromise;
}
export async function withTimeout(promise, timeoutMs = 15000, label = "Upstream request") {
    let timer = null;
    try {
        return await Promise.race([
            promise,
            new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
            }),
        ]);
    }
    finally {
        if (timer)
            clearTimeout(timer);
    }
}
/**
 * Bounded retry wrapper with exponential backoff and jitter.
 * Retries at most `maxAttempts` times on transient network/5xx errors.
 */
export async function retryWithBackoff(operation, opts = {}) {
    const maxAttempts = opts.maxAttempts ?? 2;
    const baseDelayMs = opts.baseDelayMs ?? 300;
    const label = opts.label ?? "ai_operation";
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await operation();
        }
        catch (err) {
            lastError = err;
            const msg = err instanceof Error ? err.message : String(err);
            // Do not retry authentication or 4xx client errors
            if (/401|403|400|invalid|unauthorized/i.test(msg)) {
                throw err;
            }
            if (attempt < maxAttempts) {
                const jitter = Math.floor(Math.random() * 120);
                const delay = baseDelayMs * Math.pow(2, attempt - 1) + jitter;
                logger.warn("ai.retry_attempt", { label, attempt, delayMs: delay, error: msg });
                await new Promise((r) => setTimeout(r, delay));
            }
        }
    }
    throw lastError;
}
