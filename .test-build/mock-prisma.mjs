export const mockWaitlistRows = new Map();
export let mockDbShouldFail = false;
export function setMockDbShouldFail(v) { mockDbShouldFail = v; }
export function resetMockDb() { mockWaitlistRows.clear(); mockDbShouldFail = false; }
export class PrismaClient {
  async $queryRaw() {
    if (mockDbShouldFail) throw new Error("SQLite disk I/O error");
    return [{ 1: 1 }];
  }
  waitlist = {
    create: async ({ data }) => {
      if (mockDbShouldFail) throw new Error("Database connection refused");
      if (mockWaitlistRows.has(data.email)) {
        const err = new Error("Unique constraint failed");
        err.code = "P2002";
        throw err;
      }
      mockWaitlistRows.set(data.email, data);
      return data;
    },
    count: async () => {
      if (mockDbShouldFail) throw new Error("Database connection refused");
      return mockWaitlistRows.size;
    }
  };
}
