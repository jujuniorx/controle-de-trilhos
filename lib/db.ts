import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    errorFormat: 'pretty',
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
else {
  // Ensure client is properly initialized in production
  prisma.$connect().catch(() => {
    // Connection handled by Prisma Data Proxy
  });
}
