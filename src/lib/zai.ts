import ZAI from "z-ai-web-dev-sdk";

/**
 * Shared ZAI singleton for backend-only usage.
 * Resets cached promise on initialization failure so transient errors recover automatically.
 * Never import this from a client component.
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

/**
 * Wraps an async operation with a hard timeout so hung upstream requests
 * fail fast and trigger deterministic fallback cleanly.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs = 18000,
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
