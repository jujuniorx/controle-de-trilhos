import { prisma } from '@/lib/db';
import { SALDO_INICIAL_2026 } from '@/lib/estoque/saldoInicial2026';
import { lancamentosDeCarga, lancamentosDeMovimentacao, lancamentosDeProducao, type MovFonte } from '@/lib/estoque/derivacoes';
import { CORTE_SALDO_INICIAL, somarSaldos, type Lancamento, type OrigemTipo, type Posicao, type Saldo } from '@/lib/estoque/trilhos';
import { respostaTlsDaLinha } from '@/lib/services/producao';

/** Itens da conferência com o SAP (toneladas, somando as malhas MP + MN + FIPS). */
export const ITENS_SAP = ['TLS_TR60', 'TLS_TR68', 'TLS_UIC60', 'BARRAS_TR60', 'BARRAS_TR68', 'BARRAS_UIC60'] as const;
export type ItemSap = (typeof ITENS_SAP)[number];

export interface EstoqueTrilhos {
  saldos: Saldo[];
  /** Todos os lançamentos (saldo inicial, ajustes e os calculados), do mais antigo para o mais novo. */
  lancamentos: Lancamento[];
  sap: Partial<Record<ItemSap, number>>;
  /** Data e hora do último fato que mexeu no saldo (ISO). */
  atualizadoEm: string | null;
  temSaldoInicial: boolean;
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : '');
const corte = () => new Date(`${CORTE_SALDO_INICIAL}T00:00:00Z`);

/** Grava o saldo da planilha de 25/11/2026. Não faz nada se já estiver gravado. */
export async function carregarSaldoInicial(responsavel: string): Promise<{ criados: number }> {
  const ja = await prisma.estoqueTrilhoLancamento.count({ where: { origemTipo: 'SALDO_INICIAL' } });
  if (ja > 0) return { criados: 0 };
  const r = await prisma.estoqueTrilhoLancamento.createMany({
    data: SALDO_INICIAL_2026.map((l) => ({
      data: corte(),
      secao: l.secao,
      perfil: l.perfil,
      tipo: l.tipo,
      fabricante: l.fabricante,
      classe: l.classe,
      metros: l.metros,
      unidades: l.unidades,
      origemTipo: 'SALDO_INICIAL',
      responsavel,
    })),
  });
  return { criados: r.count };
}

function rotuloMovimentacao(m: { tipo: string; tipoTransporte: string; numeroDocumento: string | null; origem: string | null; destino: string | null }): string {
  if (m.tipoTransporte === 'VAGAO') return `Vagão ${(m.origem ?? '').replace(/^VAGÃO\s*/i, '') || ''}`.trim();
  const nf = m.numeroDocumento ? ` NF ${m.numeroDocumento}` : '';
  return m.tipo === 'REMETIDO' ? `Envio${nf}${m.destino ? ` · ${m.destino}` : ''}` : `Recebimento${nf}${m.origem ? ` · ${m.origem}` : ''}`;
}

export async function montarEstoqueTrilhos(): Promise<EstoqueTrilhos> {
  const depoisDoCorte = { gt: corte() };
  const [gravados, movs, dias, cargas, sap] = await Promise.all([
    prisma.estoqueTrilhoLancamento.findMany({ orderBy: { criadoEm: 'asc' } }),
    prisma.movimentacao.findMany({
      where: { status: 'CONFERIDO', dataMovimentacao: depoisDoCorte },
      include: { grupos: { include: { medicoes: { select: { metros: true, classificacaoSC: true } } } } },
    }),
    prisma.producaoDia.findMany({ where: { data: depoisDoCorte }, include: { linhas: true } }),
    prisma.trilheiroCarga.findMany({ where: { boEm: depoisDoCorte } }),
    prisma.estoqueSapValor.findMany(),
  ]);

  const lancamentos: Lancamento[] = gravados.map((g) => ({
    secao: g.secao as Posicao['secao'],
    perfil: g.perfil,
    tipo: g.tipo as Posicao['tipo'],
    fabricante: g.fabricante as Posicao['fabricante'],
    classe: g.classe,
    data: iso(g.data),
    metros: Number(g.metros),
    unidades: g.unidades,
    origemTipo: g.origemTipo as OrigemTipo,
    origemId: g.id,
    descricao: g.origemTipo === 'SALDO_INICIAL' ? 'Saldo inicial (planilha de 25/11/2026)' : `Ajuste · ${g.responsavel}${g.motivo ? ` · ${g.motivo}` : ''}`,
  }));

  for (const m of movs) {
    const fonte: MovFonte = {
      id: m.id,
      tipo: m.tipo,
      status: m.status,
      data: iso(m.dataMovimentacao),
      rotulo: rotuloMovimentacao(m),
      grupos: m.grupos.map((g) => ({
        tipoMaterial: g.tipoMaterial,
        perfil: g.perfil,
        classificacao: g.classificacao,
        fabricante: g.fabricante,
        formaNovo: g.formaNovo,
        metrosTotal: Number(g.metrosTotal),
        medicoes: g.medicoes.map((x) => ({ metros: Number(x.metros), classificacaoSC: x.classificacaoSC })),
      })),
    };
    lancamentos.push(...lancamentosDeMovimentacao(fonte));
  }

  for (const d of dias) {
    const horas = [...d.linhas]
      .sort((a, b) => a.hora.localeCompare(b.hora))
      .map((l) => ({ hora: l.hora, soldas: l.soldas, fabricante: l.fabricante, perfil: l.perfil, resposta: respostaTlsDaLinha(l.paradas) }));
    lancamentos.push(...lancamentosDeProducao({ data: iso(d.data), sobraEntrada: d.sobraEntrada, ajusteTls: d.ajusteTls, horas }));
  }

  for (const c of cargas) {
    lancamentos.push(
      ...lancamentosDeCarga({ id: c.id, trilheiro: c.trilheiro, boEm: iso(c.boEm), perfil: c.perfil, reemprego: c.reemprego, fabricante: c.fabricante, quantidade: c.quantidade }),
    );
  }

  lancamentos.sort((a, b) => a.data.localeCompare(b.data));

  // "Atualizado em": o fato mais recente entre os gravados, as movimentações conferidas, a Produção e as cargas.
  const datas = [
    ...gravados.map((g) => g.criadoEm),
    ...movs.map((m) => m.conferidoEm ?? m.dataMovimentacao),
    ...dias.map((d) => d.atualizadoEm),
    ...cargas.map((c) => c.atualizadoEm),
  ].filter((d): d is Date => !!d);
  const atualizadoEm = datas.length ? new Date(Math.max(...datas.map((d) => d.getTime()))).toISOString() : null;

  return {
    saldos: somarSaldos(lancamentos),
    lancamentos,
    sap: Object.fromEntries(sap.map((s) => [s.item, Number(s.toneladas)])) as Partial<Record<ItemSap, number>>,
    atualizadoEm,
    temSaldoInicial: gravados.some((g) => g.origemTipo === 'SALDO_INICIAL'),
  };
}

/** Ajuste do admin numa linha do estoque (contagem física, correção). Sempre com motivo. */
export async function ajustarSaldoTrilho(p: Posicao, metros: number, unidades: number | null, motivo: string, responsavel: string): Promise<void> {
  const hoje = new Date(new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10) + 'T00:00:00Z');
  await prisma.estoqueTrilhoLancamento.create({
    data: {
      data: hoje,
      secao: p.secao,
      perfil: p.perfil,
      tipo: p.tipo,
      fabricante: p.fabricante,
      classe: p.classe,
      metros,
      unidades,
      origemTipo: 'AJUSTE',
      motivo,
      responsavel,
    },
  });
}

export async function salvarValorSap(item: ItemSap, toneladas: number, responsavel: string): Promise<void> {
  await prisma.estoqueSapValor.upsert({ where: { item }, create: { item, toneladas, responsavel }, update: { toneladas, responsavel } });
}
