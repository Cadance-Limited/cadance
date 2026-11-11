import { PrismaClient } from "./mock-prisma.mjs";
const globalForPrisma = globalThis;
export const db = globalForPrisma.prisma ??
    new PrismaClient({
        log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = db;
}
