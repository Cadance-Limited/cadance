import ZAI from "z-ai-web-dev-sdk";
import { logger } from "./logger";

/**
 * Shared ZAI singleton for backend-only usage.
 * Resets cached promise on initialization failure and supports bounded retries
 * with exponential backoff + jitter for transient provider errors.
 */
let zaiPromise: Promise<ZAI> | null = null;

export function getZAI(): Promise<ZAI> {
  if (!zaiPromise) {
    zaiPromise = ZAI.create().catch((err) => {
      zaiPromise = null;
      throw err;
    });
  }
  return zaiPromise;
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs = 15000,
  label = "Upstream request",
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Bounded retry wrapper with exponential backoff and jitter.
 * Retries at most `maxAttempts` times on transient network/5xx errors.
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  opts: { maxAttempts?: number; baseDelayMs?: number; label?: string } = {},
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 2;
  const baseDelayMs = opts.baseDelayMs ?? 300;
  const label = opts.label ?? "ai_operation";

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (err) {
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
