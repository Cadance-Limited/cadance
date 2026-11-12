import net from "node:net";
import { getEnv } from "./env";
import { logger } from "./logger";

/**
 * Production rate limiter implementing a weighted sliding-window algorithm and
 * non-spoofable client identification:
 * 1. Atomic distributed sliding-window rate limiting via Upstash Redis REST API when configured.
 * 2. Trusted client identification:
 *    - Never uses attacker-controlled `User-Agent`, `Accept-Language`, or `Sec-CH-UA` headers
 *      to mint rate-limit buckets.
 *    - When `TRUST_PROXY=true`, resolves the verified client IP from an explicit `TRUSTED_IP_HEADER`,
 *      platform-verified headers (`CF-Connecting-IP`, `X-Real-IP`, `X-Vercel-Forwarded-For`), or
 *      right-to-left hop counting on `X-Forwarded-For` (`TRUSTED_PROXY_HOPS`, default 1) so clients
 *      cannot spoof the leftmost `X-Forwarded-For` entry.
 *    - When `TRUST_PROXY=false`, ignores all HTTP forwarding headers and falls back to the
 *      non-spoofable `"unproxied-local"` bucket (or an authenticated `principalId` when provided).
 * 3. Explicit production failure policy: fails closed in production when `ALLOW_IN_MEMORY_RATE_LIMIT=false`
 *    and Redis is absent or unreachable.
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

function normalizeValidatedIp(raw: string | undefined | null): string | null {
  if (!raw) return null;
  let candidate = raw.trim();
  if (!candidate) return null;
  // Strip IPv6 brackets or port suffix if attached by proxy
  if (candidate.startsWith("[") && candidate.includes("]")) {
    candidate = candidate.slice(1, candidate.indexOf("]"));
  } else if (
    candidate.includes(":") &&
    candidate.indexOf(":") === candidate.lastIndexOf(":")
  ) {
    const [hostPart, portPart] = candidate.split(":");
    if (/^\d+$/.test(portPart ?? "")) {
      candidate = hostPart;
    }
  }
  return net.isIP(candidate) !== 0 ? candidate.toLowerCase() : null;
}

/**
 * Resolves the trusted client identifier for rate limiting:
 * - If an authenticated `principalId` is supplied in `opts`, scopes the key to `principal:<id>`.
 * - When `TRUST_PROXY=true`, extracts the verified client IP from:
 *   1. `env.TRUSTED_IP_HEADER` (if explicitly configured for the deployment ingress)
 *   2. `cf-connecting-ip`, `x-vercel-forwarded-for`, or `x-real-ip`
 *   3. `x-forwarded-for` evaluated right-to-left using `env.TRUSTED_PROXY_HOPS` (default 1,
 *      selecting the hop appended by the trusted ingress proxy rather than the client-spoofable leftmost item).
 * - When `TRUST_PROXY=false`, ignores all forwarding and user-agent headers and returns `"unproxied-local"`.
 */
export function getClientIp(
  headers: Headers,
  opts?: { principalId?: string | null },
): string {
  if (opts?.principalId) {
    return `principal:${opts.principalId}`;
  }

  const env = getEnv();
  if (!env.TRUST_PROXY) {
    return "unproxied-local";
  }

  if (env.TRUSTED_IP_HEADER) {
    const customHeader = headers.get(env.TRUSTED_IP_HEADER);
    if (customHeader) {
      const parts = customHeader
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      const hopIdx = Math.max(0, parts.length - env.TRUSTED_PROXY_HOPS);
      const validCustom = normalizeValidatedIp(parts[hopIdx]);
      if (validCustom) return validCustom;
    }
  }

  const cfIp = normalizeValidatedIp(headers.get("cf-connecting-ip"));
  if (cfIp) return cfIp;

  const vercelIp = normalizeValidatedIp(
    headers.get("x-vercel-forwarded-for")?.split(",")[0],
  );
  if (vercelIp) return vercelIp;

  const realIp = normalizeValidatedIp(headers.get("x-real-ip"));
  if (realIp) return realIp;

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const ips = forwarded
      .split(",")
      .map((ip) => ip.trim())
      .filter(Boolean);
    if (ips.length > 0) {
      const idx = Math.max(0, ips.length - env.TRUSTED_PROXY_HOPS);
      const selected = normalizeValidatedIp(ips[idx]);
      if (selected) return selected;
    }
  }

  return "unverified-proxy-client";
}

export type RateLimitOptions = {
  namespace: string;
  limit: number;
  windowMs: number;
  principalId?: string | null;
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
  const prevWeight = Math.max(
    0,
    (opts.windowMs - elapsedInWindow) / opts.windowMs,
  );
  const projectedCount =
    Math.floor(state.prevCount * prevWeight) + state.currCount + 1;

  const allowed = projectedCount <= opts.limit;
  if (allowed) {
    state.currCount += 1;
  }

  const effectiveAfter =
    Math.floor(state.prevCount * prevWeight) + state.currCount;
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

  const data = (await response.json()) as Array<{
    result?: string | number | null;
  }>;
  const prevCount = Number(data?.[0]?.result ?? 0) || 0;
  const currCount = Number(data?.[1]?.result ?? 1) || 1;

  const elapsedInWindow = now - currentWindowStart;
  const prevWeight = Math.max(
    0,
    (opts.windowMs - elapsedInWindow) / opts.windowMs,
  );
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
  const clientKey = getClientIp(reqHeaders, { principalId: opts.principalId });
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
