import { prisma } from '@/lib/db';
import { chaveLocal } from '@/lib/domain/local';

/**
 * Serra: trilho recolhido nas cidades da serra (Evangelista e Paratinga) e o que já chegou à usina.
 * - Recolhido: lançado em unidades (1 unidade ≈ 10 m).
 * - Na usina: soma automática dos recebimentos com origem na cidade (metros).
 * - Ainda não chegou: recolhido − na usina (nunca negativo).
 */

export const CIDADES_SERRA = ['EVANGELISTA', 'PARATINGA'] as const;
export const ROTULO_CIDADE: Record<(typeof CIDADES_SERRA)[number], string> = { EVANGELISTA: 'Evangelista', PARATINGA: 'Paratinga' };
export const METROS_POR_UNIDADE = 10;
export const META_SERRA_M = 47625;

export interface ResumoCidadeSerra {
  cidade: (typeof CIDADES_SERRA)[number];
  rotulo: string;
  recolhidoM: number;
  naUsinaM: number;
  aChegarM: number;
}

export async function resumoSerra(): Promise<{ cidades: ResumoCidadeSerra[]; recolhidoM: number; naUsinaM: number; aChegarM: number; metaM: number }> {
  const [recolhidos, recebidos, historico, movs] = await Promise.all([
    prisma.recolhimentoSerra.groupBy({ by: ['cidade'], _sum: { unidades: true } }),
    prisma.grupo.findMany({
      where: { movimentacao: { tipo: 'RECEBIMENTO', origem: { not: null } } },
      select: { metrosTotal: true, movimentacao: { select: { origem: true } } },
    }),
    prisma.recebimentoSerraHistorico.findMany({ where: { data: { gte: new Date('2026-01-01T00:00:00Z') } }, select: { nf: true, cidade: true, metrosTotal: true } }),
    prisma.movimentacao.findMany({
      where: { tipo: 'RECEBIMENTO', OR: [{ numeroDocumento: { not: null } }, { numerosDocumentoExtras: { isEmpty: false } }] },
      select: { numeroDocumento: true, numerosDocumentoExtras: true },
    }),
  ]);
  // NFs que já estão no sistema: a soma delas vem dos recebimentos, então não entram de novo pela planilha.
  const nfsNoSistema = new Set<string>();
  for (const m of movs) {
    if (m.numeroDocumento) nfsNoSistema.add(m.numeroDocumento.trim());
    for (const extra of m.numerosDocumentoExtras) nfsNoSistema.add(extra.trim());
  }
  const historicoNovo = historico.filter((h) => !nfsNoSistema.has(h.nf.trim()));

  const cidades = CIDADES_SERRA.map((cidade) => {
    const unidades = recolhidos.find((r) => r.cidade === cidade)?._sum.unidades ?? 0;
    const recolhidoM = unidades * METROS_POR_UNIDADE;
    const doSistema = recebidos
      .filter((g) => chaveLocal(g.movimentacao.origem) === cidade)
      .reduce((soma, g) => soma + Number(g.metrosTotal), 0);
    const daPlanilha = historicoNovo
      .filter((h) => h.cidade === cidade)
      .reduce((soma, h) => soma + Number(h.metrosTotal ?? 0), 0);
    const naUsinaM = doSistema + daPlanilha;
    return { cidade, rotulo: ROTULO_CIDADE[cidade], recolhidoM, naUsinaM, aChegarM: Math.max(recolhidoM - naUsinaM, 0) };
  });

  const soma = (campo: 'recolhidoM' | 'naUsinaM' | 'aChegarM') => cidades.reduce((t, c) => t + c[campo], 0);
  return { cidades, recolhidoM: soma('recolhidoM'), naUsinaM: soma('naUsinaM'), aChegarM: soma('aChegarM'), metaM: META_SERRA_M };
}
