import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    errorFormat: 'pretty',
    // O padrão (5 s) estoura em cargas grandes no banco remoto; transação que estoura volta atrás e o
    // recebimento nunca salva. 30 s dá folga sem prender conexões.
    transactionOptions: { timeout: 30_000, maxWait: 10_000 },
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
else {
  // Ensure client is properly initialized in production
  prisma.$connect().catch(() => {
    // Connection handled by Prisma Data Proxy
  });
}
