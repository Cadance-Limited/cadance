import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  fallbackWaitlist: Map<
    string,
    { email: string; source: string; company?: string; role?: string; createdAt: Date }
  > | undefined;
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
 * In-memory fallback registry used when SQLite is mounted on a read-only
 * serverless filesystem or before migrations are pushed.
 */
export const fallbackWaitlist =
  globalForPrisma.fallbackWaitlist ??
  new Map<
    string,
    { email: string; source: string; company?: string; role?: string; createdAt: Date }
  >();

if (!globalForPrisma.fallbackWaitlist) {
  globalForPrisma.fallbackWaitlist = fallbackWaitlist;
}
