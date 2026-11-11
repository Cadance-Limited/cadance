/**
 * Centralized environment configuration and validation.
 * Ensures production deployments fail explicitly when required configuration is missing
 * and never silently inherit unsafe development defaults.
 */

export type AppEnv = {
  NODE_ENV: "development" | "production" | "test";
  DATABASE_URL: string;
  NEXT_PUBLIC_APP_URL: string;
  TRUST_PROXY: boolean;
  UPSTASH_REDIS_REST_URL: string | null;
  UPSTASH_REDIS_REST_TOKEN: string | null;
  ALLOW_IN_MEMORY_RATE_LIMIT: boolean;
  LOG_LEVEL: "debug" | "info" | "warn" | "error";
};

function parseBoolean(val: string | undefined, defaultVal = false): boolean {
  if (!val) return defaultVal;
  const norm = val.trim().toLowerCase();
  return norm === "1" || norm === "true" || norm === "yes";
}

export function getEnv(): AppEnv {
  const rawNodeEnv = process.env.NODE_ENV ?? "development";
  const nodeEnv: AppEnv["NODE_ENV"] =
    rawNodeEnv === "production" || rawNodeEnv === "test"
      ? rawNodeEnv
      : "development";

  const dbUrl =
    process.env.DATABASE_URL?.trim() ||
    (nodeEnv === "production" ? "" : "file:./dev.db");

  if (nodeEnv === "production" && !dbUrl) {
    throw new Error(
      "Missing required environment variable: DATABASE_URL must be configured in production.",
    );
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://cadence.ai";

  const rawLogLevel = (process.env.LOG_LEVEL ?? "info").trim().toLowerCase();
  const logLevel: AppEnv["LOG_LEVEL"] =
    rawLogLevel === "debug" ||
    rawLogLevel === "info" ||
    rawLogLevel === "warn" ||
    rawLogLevel === "error"
      ? rawLogLevel
      : "info";

  return {
    NODE_ENV: nodeEnv,
    DATABASE_URL: dbUrl,
    NEXT_PUBLIC_APP_URL: appUrl,
    TRUST_PROXY: parseBoolean(process.env.TRUST_PROXY, false),
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL?.trim() || null,
    UPSTASH_REDIS_REST_TOKEN:
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim() || null,
    ALLOW_IN_MEMORY_RATE_LIMIT: parseBoolean(
      process.env.ALLOW_IN_MEMORY_RATE_LIMIT,
      nodeEnv !== "production",
    ),
    LOG_LEVEL: logLevel,
  };
}
