import { getEnv } from "./env";
import { logger } from "./logger";

/**
 * Production rate limiter supporting:
 * 1. Atomic distributed rate limiting via Upstash Redis REST API when configured
 * 2. Trusted proxy IP resolution (only trusting forwarding headers when TRUST_PROXY=true)
 * 3. Deterministic sliding-window memory store for local development and tests
 */

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5000;

function pruneExpired(now: number) {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function resetRateLimitStoreForTests() {
  buckets.clear();
}

/**
 * Resolves the client IP safely. Forwarding headers (X-Forwarded-For, X-Real-IP,
 * CF-Connecting-IP) are ONLY trusted when TRUST_PROXY=true is explicitly set in
 * the deployment environment, preventing attackers from spoofing X-Forwarded-For
 * to bypass rate limits.
 */
export function getClientIp(headers: Headers): string {
  const env = getEnv();
  if (!env.TRUST_PROXY) {
    return "direct-client";
  }

  const cfIp = headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;

  const vercelIp = headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (vercelIp) return vercelIp;

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "direct-client";
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

function checkInMemoryRateLimit(
  key: string,
  opts: RateLimitOptions,
  now: number,
): RateLimitResult {
  pruneExpired(now);
  const existing = buckets.get(key);

  let bucket: Bucket;
  if (!existing || existing.resetAt <= now) {
    bucket = { count: 1, resetAt: now + opts.windowMs };
    buckets.set(key, bucket);
  } else {
    bucket = existing;
    bucket.count += 1;
  }

  const allowed = bucket.count <= opts.limit;
  const remaining = Math.max(0, opts.limit - bucket.count);

  return {
    allowed,
    limit: opts.limit,
    remaining,
    resetAt: bucket.resetAt,
    headers: buildHeaders(opts.limit, remaining, bucket.resetAt, allowed, now),
  };
}

/**
 * Executes an atomic INCR + PEXPIRE pipeline against Upstash Redis REST API.
 */
async function checkDistributedRedisRateLimit(
  redisUrl: string,
  redisToken: string,
  key: string,
  opts: RateLimitOptions,
  now: number,
): Promise<RateLimitResult> {
  const windowBucket = Math.floor(now / opts.windowMs);
  const redisKey = `cadence:rl:${key}:${windowBucket}`;
  const resetAt = (windowBucket + 1) * opts.windowMs;

  const endpoint = `${redisUrl.replace(/\/$/, "")}/pipeline`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${redisToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", redisKey],
      ["PEXPIRE", redisKey, opts.windowMs],
    ]),
    signal: AbortSignal.timeout(2500),
  });

  if (!response.ok) {
    throw new Error(`Redis rate-limit HTTP ${response.status}`);
  }

  const data = (await response.json()) as Array<{ result?: number }>;
  const count = Number(data?.[0]?.result ?? 1);
  const allowed = count <= opts.limit;
  const remaining = Math.max(0, opts.limit - count);

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
  const ip = getClientIp(reqHeaders);
  const key = `${opts.namespace}:${ip}`;

  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      return await checkDistributedRedisRateLimit(
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
    logger.warn("rate_limit.unconfigured_in_production", {
      namespace: opts.namespace,
      hint: "Configure UPSTASH_REDIS_REST_URL/TOKEN or set ALLOW_IN_MEMORY_RATE_LIMIT=true for single-instance deployments.",
    });
  }

  return checkInMemoryRateLimit(key, opts, now);
}
