/**
 * Lightweight in-memory sliding-window rate limiter for API routes.
 * Automatically prunes expired buckets to bound memory usage in long-running processes.
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

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "127.0.0.1";
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

export function checkRateLimit(
  reqHeaders: Headers,
  opts: RateLimitOptions,
): RateLimitResult {
  const now = Date.now();
  pruneExpired(now);

  const ip = getClientIp(reqHeaders);
  const key = `${opts.namespace}:${ip}`;
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
  const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(opts.limit),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(Math.ceil(bucket.resetAt / 1000)),
  };

  if (!allowed) {
    headers["Retry-After"] = String(retryAfterSec);
  }

  return {
    allowed,
    limit: opts.limit,
    remaining,
    resetAt: bucket.resetAt,
    headers,
  };
}
