import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  sqliteConfigured: boolean | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

/**
 * Configures SQLite concurrency pragmas (WAL journal mode + 5000ms busy_timeout)
 * on first database access so concurrent read/write requests on single-node SQLite
 * deployments do not fail immediately with SQLITE_BUSY. No-op if using PostgreSQL.
 */
export async function ensureDatabaseReady(): Promise<void> {
  if (globalForPrisma.sqliteConfigured) return;
  const dbUrl = process.env.DATABASE_URL ?? "file:./dev.db";
  if (dbUrl.startsWith("file:")) {
    try {
      await db.$queryRawUnsafe("PRAGMA journal_mode = WAL;");
      await db.$queryRawUnsafe("PRAGMA busy_timeout = 5000;");
      await db.$queryRawUnsafe("PRAGMA synchronous = NORMAL;");
    } catch {
      /* ignore if PRAGMA is unsupported by mock or external provider */
    }
  }
  globalForPrisma.sqliteConfigured = true;
}
