import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Banco remoto (Neon) "dorme" quando fica parado: a primeira consulta depois disso às vezes falha
 * ("Can't reach database server", "Server has closed the connection") e a tela mostra "This page
 * couldn't load" até recarregar. Só LEITURAS são repetidas (até 3 tentativas), porque repetir uma
 * escrita poderia gravar duas vezes; as escritas do Pátio já têm a fila offline que tenta de novo.
 */
const CODIGOS_TRANSITORIOS = new Set(['P1001', 'P1002', 'P1008', 'P1017', 'P2024']);
const OPERACOES_DE_LEITURA = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
]);
const ESPERAS_MS = [400, 1200];

export function erroTransitorioDeBanco(erro: unknown): boolean {
  if (erro instanceof Prisma.PrismaClientInitializationError) return true;
  if (erro instanceof Prisma.PrismaClientKnownRequestError && CODIGOS_TRANSITORIOS.has(erro.code)) return true;
  const msg = erro instanceof Error ? erro.message : '';
  return /closed the connection|can't reach database|connection (?:terminated|reset|timed out)|ECONNRESET|ETIMEDOUT/i.test(msg);
}

function criarCliente() {
  const base = new PrismaClient({
    errorFormat: 'pretty',
    // O padrão (5 s) estoura em cargas grandes no banco remoto; transação que estoura volta atrás e o
    // recebimento nunca salva. 30 s dá folga sem prender conexões.
    transactionOptions: { timeout: 30_000, maxWait: 10_000 },
  });

  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ operation, args, query }) {
          if (!OPERACOES_DE_LEITURA.has(operation)) return query(args);
          for (let tentativa = 0; ; tentativa++) {
            try {
              return await query(args);
            } catch (erro) {
              if (tentativa >= ESPERAS_MS.length || !erroTransitorioDeBanco(erro)) throw erro;
              await new Promise((r) => setTimeout(r, ESPERAS_MS[tentativa]));
            }
          }
        },
      },
    },
  });
}

type Cliente = ReturnType<typeof criarCliente>;
const globalForPrisma = globalThis as unknown as { prisma?: Cliente };

export const prisma = globalForPrisma.prisma ?? criarCliente();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
else {
  // Acorda a conexão logo na subida da função
  prisma.$connect().catch(() => {
    // a primeira consulta tenta de novo (ver acima)
  });
}
