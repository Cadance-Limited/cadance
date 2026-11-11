import crypto from "node:crypto";
import { getEnv } from "./env";
import { logger } from "./logger";

/**
 * Production rate limiter implementing a true weighted sliding-window algorithm:
 * 1. Atomic distributed sliding-window rate limiting via Upstash Redis REST API when configured
 * 2. Trusted proxy IP resolution when TRUST_PROXY=true, and privacy-preserving per-client
 *    request fingerprint bucketing when TRUST_PROXY=false (never collapsing all visitors into a
 *    single global static bucket while still ignoring spoofed X-Forwarded-For headers)
 * 3. Explicit production failure policy: fails closed in production when ALLOW_IN_MEMORY_RATE_LIMIT=false
 *    and Redis is absent or unreachable
 */

type SlidingWindowState = {
  prevCount: number;
  currCount: number;
  windowStart: number;
};

const windows = new Map<string, SlidingWindowState>();
const MAX_BUCKETS = 5000;

function pruneExpired(now: number, windowMs: number) {
  if (windows.size < MAX_BUCKETS) return;
  for (const [key, state] of windows.entries()) {
    if (now - state.windowStart >= windowMs * 2) {
      windows.delete(key);
    }
  }
}

export function resetRateLimitStoreForTests() {
  windows.clear();
}

/**
 * Resolves the client identifier for rate limiting:
 * - When TRUST_PROXY=true, extracts the verified client IP from CF-Connecting-IP,
 *   X-Vercel-Forwarded-For, X-Real-IP, or X-Forwarded-For.
 * - When TRUST_PROXY=false, ignores spoofable IP forwarding headers completely and
 *   computes a deterministic hash from non-forwarding client headers (User-Agent,
 *   Accept-Language, Sec-CH-UA) so distinct browsers do not collide in a single bucket
 *   while an attacker cannot rotate X-Forwarded-For to bypass limits.
 */
export function getClientIp(headers: Headers): string {
  const env = getEnv();
  if (env.TRUST_PROXY) {
    const cfIp = headers.get("cf-connecting-ip")?.trim();
    if (cfIp) return cfIp;

    const vercelIp = headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
    if (vercelIp) return vercelIp;

    const realIp = headers.get("x-real-ip")?.trim();
    if (realIp) return realIp;

    const forwarded = headers.get("x-forwarded-for");
    if (forwarded) {
      const first = forwarded.split(",")[0]?.trim();
      if (first) return first;
    }
  }

  const ua = headers.get("user-agent")?.trim() ?? "";
  const lang = headers.get("accept-language")?.trim() ?? "";
  const chUa = headers.get("sec-ch-ua")?.trim() ?? "";
  if (!ua && !lang && !chUa) {
    return "direct-client";
  }
  const digest = crypto
    .createHash("sha256")
    .update(`${ua}|${lang}|${chUa}`)
    .digest("hex")
    .slice(0, 16);
  return `client_${digest}`;
}

export type RateLimitOptions = {
  namespace: string;
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  headers: Record<string, string>;
};

function buildHeaders(
  limit: number,
  remaining: number,
  resetAt: number,
  allowed: boolean,
  now: number,
): Record<string, string> {
  const retryAfterSec = Math.max(1, Math.ceil((resetAt - now) / 1000));
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
  };
  if (!allowed) {
    headers["Retry-After"] = String(retryAfterSec);
  }
  return headers;
}

/**
 * Weighted sliding-window counter approximation:
 * Combines the previous window's count (weighted by the remaining overlap fraction)
 * with the current window's count to prevent 2x boundary burst traffic.
 */
function checkInMemorySlidingWindow(
  key: string,
  opts: RateLimitOptions,
  now: number,
): RateLimitResult {
  pruneExpired(now, opts.windowMs);
  const currentWindowIndex = Math.floor(now / opts.windowMs);
  const currentWindowStart = currentWindowIndex * opts.windowMs;
  const resetAt = currentWindowStart + opts.windowMs;

  let state = windows.get(key);
  if (!state) {
    state = { prevCount: 0, currCount: 0, windowStart: currentWindowStart };
    windows.set(key, state);
  } else if (currentWindowStart > state.windowStart) {
    const elapsedWindows = Math.round(
      (currentWindowStart - state.windowStart) / opts.windowMs,
    );
    state.prevCount = elapsedWindows === 1 ? state.currCount : 0;
    state.currCount = 0;
    state.windowStart = currentWindowStart;
  }

  const elapsedInWindow = now - currentWindowStart;
  const prevWeight = Math.max(0, (opts.windowMs - elapsedInWindow) / opts.windowMs);
  const projectedCount = Math.floor(state.prevCount * prevWeight) + state.currCount + 1;

  const allowed = projectedCount <= opts.limit;
  if (allowed) {
    state.currCount += 1;
  }

  const effectiveAfter = Math.floor(state.prevCount * prevWeight) + state.currCount;
  const remaining = Math.max(0, opts.limit - effectiveAfter);

  return {
    allowed,
    limit: opts.limit,
    remaining,
    resetAt,
    headers: buildHeaders(opts.limit, remaining, resetAt, allowed, now),
  };
}

/**
 * Distributed weighted sliding-window rate limiter using Upstash Redis REST pipeline.
 * Fetches the previous window's counter and atomically increments the current window's counter.
 */
async function checkDistributedRedisSlidingWindow(
  redisUrl: string,
  redisToken: string,
  key: string,
  opts: RateLimitOptions,
  now: number,
): Promise<RateLimitResult> {
  const currWindow = Math.floor(now / opts.windowMs);
  const prevWindow = currWindow - 1;
  const currentWindowStart = currWindow * opts.windowMs;
  const resetAt = (currWindow + 1) * opts.windowMs;

  const prevKey = `cadence:rl:${key}:${prevWindow}`;
  const currKey = `cadence:rl:${key}:${currWindow}`;

  const endpoint = `${redisUrl.replace(/\/$/, "")}/pipeline`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${redisToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["GET", prevKey],
      ["INCR", currKey],
      ["PEXPIRE", currKey, opts.windowMs * 2],
    ]),
    signal: AbortSignal.timeout(2500),
  });

  if (!response.ok) {
    throw new Error(`Redis rate-limit HTTP ${response.status}`);
  }

  const data = (await response.json()) as Array<{ result?: string | number | null }>;
  const prevCount = Number(data?.[0]?.result ?? 0) || 0;
  const currCount = Number(data?.[1]?.result ?? 1) || 1;

  const elapsedInWindow = now - currentWindowStart;
  const prevWeight = Math.max(0, (opts.windowMs - elapsedInWindow) / opts.windowMs);
  const effectiveCount = Math.floor(prevCount * prevWeight) + currCount;

  const allowed = effectiveCount <= opts.limit;
  const remaining = Math.max(0, opts.limit - effectiveCount);

  return {
    allowed,
    limit: opts.limit,
    remaining,
    resetAt,
    headers: buildHeaders(opts.limit, remaining, resetAt, allowed, now),
  };
}

export async function checkRateLimit(
  reqHeaders: Headers,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  const now = Date.now();
  const env = getEnv();
  const clientKey = getClientIp(reqHeaders);
  const key = `${opts.namespace}:${clientKey}`;

  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      return await checkDistributedRedisSlidingWindow(
        env.UPSTASH_REDIS_REST_URL,
        env.UPSTASH_REDIS_REST_TOKEN,
        key,
        opts,
        now,
      );
    } catch (err) {
      logger.error("rate_limit.redis_failure", {
        namespace: opts.namespace,
        error: err instanceof Error ? err.message : "Unknown Redis error",
      });
      if (env.NODE_ENV === "production" && !env.ALLOW_IN_MEMORY_RATE_LIMIT) {
        const resetAt = now + opts.windowMs;
        return {
          allowed: false,
          limit: opts.limit,
          remaining: 0,
          resetAt,
          headers: buildHeaders(opts.limit, 0, resetAt, false, now),
        };
      }
    }
  } else if (env.NODE_ENV === "production" && !env.ALLOW_IN_MEMORY_RATE_LIMIT) {
    logger.error("rate_limit.missing_redis_in_production", {
      namespace: opts.namespace,
      hint: "Configure UPSTASH_REDIS_REST_URL/TOKEN or explicitly set ALLOW_IN_MEMORY_RATE_LIMIT=true for single-instance deployments.",
    });
    const resetAt = now + opts.windowMs;
    return {
      allowed: false,
      limit: opts.limit,
      remaining: 0,
      resetAt,
      headers: buildHeaders(opts.limit, 0, resetAt, false, now),
    };
  }

  return checkInMemorySlidingWindow(key, opts, now);
}
