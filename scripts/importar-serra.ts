/**
 * Carrega os recebidos da serra (planilha de triagem) para RecebimentoSerraHistorico.
 * Idempotente: a chave é (aba, linha da planilha), então rodar de novo não duplica.
 * Quando a NF já existe como recebimento no sistema, a linha fica guardada mas NÃO é somada de novo
 * (o resumo da serra descarta NFs que já estão no sistema).
 * Uso: DATABASE_URL=... DIRECT_DATABASE_URL=... npx tsx scripts/importar-serra.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Linha = {
  sheet: string;
  linha: number;
  nf: string;
  data: string;
  cidade: 'EVANGELISTA' | 'PARATINGA';
  placa: string | null;
  descricao: string | null;
  pecas: number | null;
  pesoT: number | null;
  metrosTotal: number | null;
};

async function main() {
  const linhas = JSON.parse(readFileSync(join(process.cwd(), 'scripts', 'dados', 'serra-recebidos.json'), 'utf8')) as Linha[];
  // Só 2026 entra na serra: o que for de anos anteriores sai do banco.
  const apagados = await prisma.recebimentoSerraHistorico.deleteMany({ where: { data: { lt: new Date('2026-01-01T00:00:00Z') } } });
  console.log(`Anos anteriores a 2026 removidos: ${apagados.count}.`);
  const r = await prisma.recebimentoSerraHistorico.createMany({
    data: linhas.map((l) => ({
      sheet: l.sheet,
      linha: l.linha,
      nf: l.nf,
      data: new Date(`${l.data}T00:00:00Z`),
      cidade: l.cidade,
      placa: l.placa,
      descricao: l.descricao,
      pecas: l.pecas == null ? null : Math.round(Number(l.pecas)),
      pesoT: l.pesoT == null ? null : l.pesoT,
      metrosTotal: l.metrosTotal,
    })),
    skipDuplicates: true,
  });
  console.log(`Linhas no arquivo: ${linhas.length}. Gravadas agora: ${r.count}. (As que já existiam foram ignoradas.)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
