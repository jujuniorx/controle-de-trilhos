import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    errorFormat: 'pretty',
    // Connection pooling tuning for Neon free tier
    // https://github.com/prisma/prisma/discussions/18834
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
