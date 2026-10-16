/**
 * Importa para o Relatório da usina os lançamentos de outubro/2026 das planilhas de geração de
 * trilho e das composições W61/W62 (arquivo scripts/dados/usina-out26.json).
 *
 * Idempotente: pode rodar de novo sem duplicar (upsert por data + líder/composição).
 * Uso: DATABASE_URL=... DIRECT_DATABASE_URL=... npx tsx scripts/importar-usina-outubro.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Geracao = {
  data: string;
  lider: 'ALECIO' | 'BRUNO' | 'REGINALDO';
  local: string | null;
  corteM: number | null;
  carregamentoM: number | null;
  perfil: string | null;
  quantidade: number | null;
  deixadaViaM: number | null;
  observacao: string | null;
};
type Composicao = { data: string; ativo: 'W61' | 'W62'; barras: number | null; jacares: number | null; observacao: string | null };

const dados = JSON.parse(readFileSync(join(process.cwd(), 'scripts', 'dados', 'usina-out26.json'), 'utf8')) as {
  geracao: Geracao[];
  composicoes: Composicao[];
};

const dataBanco = (s: string) => new Date(`${s}T00:00:00Z`);
const num = (v: unknown) => (v == null || v === '' ? null : Number(v));

async function main() {
  for (const g of dados.geracao) {
    const v = {
      local: g.local,
      corteM: num(g.corteM),
      carregamentoM: num(g.carregamentoM),
      perfil: g.perfil,
      quantidade: num(g.quantidade),
      deixadaViaM: num(g.deixadaViaM),
      observacao: g.observacao,
    };
    await prisma.geracaoDia.upsert({
      where: { data_lider: { data: dataBanco(g.data), lider: g.lider } },
      update: v,
      create: { data: dataBanco(g.data), lider: g.lider, ...v },
    });
  }
  for (const c of dados.composicoes) {
    const v = { barras: num(c.barras), jacares: num(c.jacares), observacao: c.observacao };
    await prisma.composicaoDia.upsert({
      where: { data_ativo: { data: dataBanco(c.data), ativo: c.ativo } },
      update: v,
      create: { data: dataBanco(c.data), ativo: c.ativo, ...v },
    });
  }
  console.log(`Importado: ${dados.geracao.length} lançamentos de geração e ${dados.composicoes.length} de composições.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
