// Diagnóstico somente leitura: por mês de 2026, quanto da serra está gravado e quanto do sistema tem metragem.
import { writeFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const mes = (d: Date) => d.toISOString().slice(0, 7);

async function main() {
  const ini = new Date('2026-01-01T00:00:00Z');
  const fim = new Date('2027-01-01T00:00:00Z');
  const serra = await prisma.recebimentoSerraHistorico.findMany({ where: { data: { gte: ini, lt: fim } }, select: { nf: true, cidade: true, data: true, metrosTotal: true } });
  const movs = await prisma.movimentacao.findMany({
    where: { tipo: 'RECEBIMENTO', OR: [{ numeroDocumento: { not: null } }, { numerosDocumentoExtras: { isEmpty: false } }] },
    select: { numeroDocumento: true, numerosDocumentoExtras: true },
  });
  const noSistema = new Set<string>();
  for (const m of movs) {
    if (m.numeroDocumento) noSistema.add(m.numeroDocumento.trim());
    for (const e of m.numerosDocumentoExtras) noSistema.add(e.trim());
  }
  const grupos = await prisma.grupo.findMany({
    where: { movimentacao: { tipo: 'RECEBIMENTO' } },
    select: { metrosTotal: true, movimentacao: { select: { origem: true, dataMovimentacao: true } } },
  });
  const out: Record<string, unknown> = {};
  const porMes: Record<string, { serraLinhas: number; serraMetros: number; serraNoSistema: number; sistemaGrupos: number; sistemaMetros: number; sistemaSemOrigem: number }> = {};
  const g = (k: string) => (porMes[k] ??= { serraLinhas: 0, serraMetros: 0, serraNoSistema: 0, sistemaGrupos: 0, sistemaMetros: 0, sistemaSemOrigem: 0 });
  for (const h of serra) {
    const x = g(mes(h.data));
    x.serraLinhas++;
    x.serraMetros += Number(h.metrosTotal ?? 0);
    if (noSistema.has(h.nf.trim())) x.serraNoSistema++;
  }
  for (const gr of grupos) {
    const d = gr.movimentacao.dataMovimentacao;
    if (!d || d < ini || d >= fim) continue;
    const x = g(mes(d));
    x.sistemaGrupos++;
    x.sistemaMetros += Number(gr.metrosTotal ?? 0);
    if (!gr.movimentacao.origem) x.sistemaSemOrigem++;
  }
  out.porMes = Object.fromEntries(Object.entries(porMes).sort());
  out.totais = { serraLinhas: serra.length, nfsNoSistemaTotal: noSistema.size, movimentacoesRecebimento: movs.length, gruposRecebimento: grupos.length };
  writeFileSync('diagnostico-serra.json', JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
