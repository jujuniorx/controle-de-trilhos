/**
 * Lança os recolhimentos de W61/W62 de 2026 com os totais informados para o informativo
 * (barras; o sistema converte em metros × 10,5). Agosto e setembro entram como total do mês,
 * no último dia; outubro entra como 340 (01/10, total de 01 a 14/10) + 105 (15/10).
 *
 * Idempotente: upsert por (data, composição). Não usa scripts/dados/usina-out26.json, que tem
 * outra granularidade e, se importado junto, duplicaria os valores.
 * Uso: DATABASE_URL=... DIRECT_DATABASE_URL=... npx tsx scripts/lancar-recolhimento-w61-w62.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const LANCAMENTOS: Array<{ data: string; ativo: 'W61' | 'W62'; barras: number; observacao: string }> = [
  { data: '2026-08-31', ativo: 'W61', barras: 456, observacao: 'Total de agosto (informado)' },
  { data: '2026-09-30', ativo: 'W61', barras: 448, observacao: 'Total de setembro (informado)' },
  { data: '2026-10-01', ativo: 'W61', barras: 340, observacao: 'Total de 01 a 14/10 (informado)' },
  { data: '2026-10-15', ativo: 'W61', barras: 105, observacao: 'Recolhido em 15/10' },
  { data: '2026-10-07', ativo: 'W62', barras: 20, observacao: 'Recolhido em 07/10' },
];

async function main() {
  for (const l of LANCAMENTOS) {
    const data = new Date(`${l.data}T00:00:00Z`);
    await prisma.composicaoDia.upsert({
      where: { data_ativo: { data, ativo: l.ativo } },
      update: { barras: l.barras, observacao: l.observacao },
      create: { data, ativo: l.ativo, barras: l.barras, observacao: l.observacao },
    });
  }
  const todos = await prisma.composicaoDia.findMany({
    where: { data: { gte: new Date('2026-01-01T00:00:00Z'), lt: new Date('2027-01-01T00:00:00Z') } },
    select: { ativo: true, barras: true },
  });
  const soma = (a: 'W61' | 'W62') => todos.filter((c) => c.ativo === a).reduce((t, c) => t + (c.barras ?? 0), 0);
  console.log(`Lançados: ${LANCAMENTOS.length}. Total 2026 — W61: ${soma('W61')} barras, W62: ${soma('W62')} barras.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
