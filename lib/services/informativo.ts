import { prisma } from '@/lib/db';
import { chaveLocal } from '@/lib/domain/local';

/**
 * Informativo do trilho: gráfico mensal (metros) de Geração, W61, W62 e Recebido estaleiro,
 * e o quadro do dia e acumulado do mês. Recolhido = planilha de recolhimento (unidades × 10 m).
 * W61/W62 = barras × 10,5 m. Meta de recolhimento: 47.625 m.
 */

export { METROS_POR_UNIDADE, METROS_POR_BARRA, META_RECOLHIMENTO_M } from '@/lib/domain/informativo';
import { METROS_POR_UNIDADE, METROS_POR_BARRA, META_RECOLHIMENTO_M, INICIO_REGISTRO_SISTEMA } from '@/lib/domain/informativo';
/** Cidade da serra a partir da origem gravada (aceita variações como "EVANGELISTA DE SOUZA"). */
export function cidadeDaOrigem(origem: string | null | undefined): 'EVANGELISTA' | 'PARATINGA' | null {
  const o = chaveLocal(origem);
  if (o.startsWith('EVANGELISTA')) return 'EVANGELISTA';
  if (o.startsWith('PARATINGA')) return 'PARATINGA';
  return null;
}


export interface Quadro { geracao: number; w61: number; w62: number; recebido: number; recolhido: number; naoChegou: number }

const vazio = (): Quadro => ({ geracao: 0, w61: 0, w62: 0, recebido: 0, recolhido: 0, naoChegou: 0 });

export async function informativoDoAno(ano: number, dia: string) {
  const inicio = new Date(Date.UTC(ano, 0, 1));
  const fim = new Date(Date.UTC(ano + 1, 0, 1));
  const [geracoes, composicoes, recolhidos, recebidosSistema, historico, movs] = await Promise.all([
    prisma.geracaoDia.findMany({ where: { data: { gte: inicio, lt: fim } }, select: { data: true, carregamentoM: true, deixadaViaM: true } }),
    prisma.composicaoDia.findMany({ where: { data: { gte: inicio, lt: fim } }, select: { data: true, ativo: true, barras: true } }),
    prisma.recolhimentoSerra.findMany({ where: { data: { gte: inicio, lt: fim } }, select: { data: true, unidades: true } }),
    prisma.grupo.findMany({
      where: { movimentacao: { tipo: 'RECEBIMENTO', origem: { not: null } } },
      select: { metrosTotal: true, movimentacao: { select: { origem: true, dataMovimentacao: true } } },
    }),
    prisma.recebimentoSerraHistorico.findMany({ where: { data: { gte: inicio, lt: fim } }, select: { nf: true, cidade: true, data: true, metrosTotal: true } }),
    prisma.movimentacao.findMany({
      where: { tipo: 'RECEBIMENTO', OR: [{ numeroDocumento: { not: null } }, { numerosDocumentoExtras: { isEmpty: false } }] },
      select: { numeroDocumento: true, numerosDocumentoExtras: true },
    }),
  ]);

  const nfsNoSistema = new Set<string>();
  for (const m of movs) {
    if (m.numeroDocumento) nfsNoSistema.add(m.numeroDocumento.trim());
    for (const e of m.numerosDocumentoExtras) nfsNoSistema.add(e.trim());
  }

  const meses: Quadro[] = Array.from({ length: 12 }, vazio);
  const mesDe = (d: Date) => d.getUTCMonth();
  const diaIso = (d: Date) => d.toISOString().slice(0, 10);
  const porDia = new Map<string, Quadro>();
  const tocar = (d: Date) => {
    const k = diaIso(d);
    if (!porDia.has(k)) porDia.set(k, vazio());
    return porDia.get(k)!;
  };

  for (const g of geracoes) {
    const v = Number(g.carregamentoM ?? 0) + Number(g.deixadaViaM ?? 0);
    meses[mesDe(g.data)].geracao += v;
    tocar(g.data).geracao += v;
  }
  for (const c of composicoes) {
    const m = Number(c.barras ?? 0) * METROS_POR_BARRA;
    const campo = c.ativo === 'W61' ? 'w61' : 'w62';
    meses[mesDe(c.data)][campo] += m;
    tocar(c.data)[campo] += m;
  }
  for (const r of recolhidos) {
    const m = r.unidades * METROS_POR_UNIDADE;
    meses[mesDe(r.data)].recolhido += m;
    tocar(r.data).recolhido += m;
  }
  for (const g of recebidosSistema) {
    if (!cidadeDaOrigem(g.movimentacao.origem)) continue;
    const data = g.movimentacao.dataMovimentacao;
    if (!data || data.getUTCFullYear() !== ano) continue;
    const m = Number(g.metrosTotal);
    meses[mesDe(data)].recebido += m;
    tocar(data).recebido += m;
  }
  // Planilha da serra só até o início do registro no sistema; depois disso, vale só o que está no sistema.
  const corteSistema = new Date(`${INICIO_REGISTRO_SISTEMA}T00:00:00Z`);
  for (const h of historico) {
    if (h.data >= corteSistema) continue;
    if (nfsNoSistema.has(h.nf.trim())) continue;
    const m = Number(h.metrosTotal ?? 0);
    meses[mesDe(h.data)].recebido += m;
    tocar(h.data).recebido += m;
  }
  // Recolhido = W61 + W62 (composição diária). A planilha da serra não tem recolhimento de 2026.
  for (const q of [...meses, ...porDia.values()]) {
    q.recolhido = q.w61 + q.w62;
    q.naoChegou = Math.max(q.recolhido - q.recebido, 0);
  }

  const somar = (lista: Quadro[]): Quadro =>
    lista.reduce((t, q) => ({ geracao: t.geracao + q.geracao, w61: t.w61 + q.w61, w62: t.w62 + q.w62, recebido: t.recebido + q.recebido, recolhido: t.recolhido + q.recolhido, naoChegou: t.naoChegou + q.naoChegou }), vazio());

  const doDia = porDia.get(dia) ?? vazio();
  const prefixo = dia.slice(0, 7);
  const acumMes = somar([...porDia.entries()].filter(([k]) => k.startsWith(prefixo) && k <= dia).map(([, q]) => q));
  const acumAno = somar(meses);
  return {
    meses,
    doDia,
    acumMes,
    acumAno,
    metaM: META_RECOLHIMENTO_M,
    saldoM: META_RECOLHIMENTO_M - acumAno.recolhido,
  };
}
