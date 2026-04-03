import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to initialize Prisma");
}

const adapter = new PrismaPg({ connectionString });

function createPrismaClient() {
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

const cachedClient = globalForPrisma.prisma;
const missingChatDelegate =
  cachedClient &&
  !("workforceChatMessage" in (cachedClient as PrismaClient & { workforceChatMessage?: unknown }));

export const prisma = missingChatDelegate
  ? createPrismaClient()
  : cachedClient ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
