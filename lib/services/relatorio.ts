import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { arredondar3 } from '@/lib/domain/regras';
import type { FiltrosRelatorioInput } from '@/lib/validation/relatorio';

export type MovimentacaoRelatorio = Prisma.MovimentacaoGetPayload<{
  include: { grupos: { include: { medicoes: true } }; remetidoDetalhe: true };
}>;

function montarWhere(filtros: FiltrosRelatorioInput): Prisma.MovimentacaoWhereInput {
  const where: Prisma.MovimentacaoWhereInput = {};

  if (filtros.tipo) where.tipo = filtros.tipo;
  if (filtros.status) where.status = filtros.status;
  if (filtros.numeroDocumento) where.numeroDocumento = { contains: filtros.numeroDocumento };

  if (filtros.origemDestino) {
    where.OR = [
      { origem: { contains: filtros.origemDestino, mode: 'insensitive' } },
      { destino: { contains: filtros.origemDestino, mode: 'insensitive' } },
    ];
  }

  if (filtros.dataInicio || filtros.dataFim) {
    where.dataMovimentacao = {
      ...(filtros.dataInicio ? { gte: new Date(`${filtros.dataInicio}T00:00:00`) } : {}),
      ...(filtros.dataFim ? { lte: new Date(`${filtros.dataFim}T23:59:59`) } : {}),
    };
  }

  if (filtros.perfil || filtros.material) {
    where.grupos = {
      some: {
        ...(filtros.perfil ? { perfil: filtros.perfil } : {}),
        ...(filtros.material ? { tipoMaterial: filtros.material } : {}),
      },
    };
  }

  return where;
}

export function buscarMovimentacoesRelatorio(filtros: FiltrosRelatorioInput): Promise<MovimentacaoRelatorio[]> {
  return prisma.movimentacao.findMany({
    where: montarWhere(filtros),
    include: { grupos: { include: { medicoes: true } }, remetidoDetalhe: true },
    orderBy: { createdAt: 'desc' },
  });
}

export interface ResumoRelatorio {
  carregamentos: number;
  pecas: number;
  metros: number;
  toneladas: number;
}

/** Peso de um grupo já conhecido: calculado (Recebimento NOVO/REEMPREGO) ou informado (Remetido). Sucata de Recebimento nunca entra aqui — mora em Movimentacao.pesoSucataReal. */
function pesoConhecidoDoGrupo(grupo: MovimentacaoRelatorio['grupos'][number]): number {
  return Number(grupo.pesoCalculado ?? grupo.pesoInformado ?? 0);
}

export function resumoRelatorio(movimentacoes: MovimentacaoRelatorio[]): ResumoRelatorio {
  let pecas = 0;
  let metros = 0;
  let toneladas = 0;

  for (const mov of movimentacoes) {
    for (const grupo of mov.grupos) {
      for (const medicao of grupo.medicoes) pecas += medicao.quantidade;
      metros += Number(grupo.metrosTotal);
      toneladas += pesoConhecidoDoGrupo(grupo);
    }
    if (mov.pesoSucataReal != null) toneladas += Number(mov.pesoSucataReal);
  }

  return { carregamentos: movimentacoes.length, pecas, metros: arredondar3(metros), toneladas: arredondar3(toneladas) };
}

export interface Pendencias {
  aguardandoConferencia: MovimentacaoRelatorio[];
  remetidosAguardandoChegada: MovimentacaoRelatorio[];
  recebidosAguardandoPesoSucata: MovimentacaoRelatorio[];
}

/** Visão operacional fixa (não respeita os filtros da tela) — "o que está travado agora", para qualquer administrador. */
export async function listarPendencias(): Promise<Pendencias> {
  const include = { grupos: { include: { medicoes: true } }, remetidoDetalhe: true } as const;

  const [aguardandoConferencia, remetidosAguardandoChegada, recebidosAguardandoPesoSucata] = await Promise.all([
    prisma.movimentacao.findMany({ where: { status: 'PENDENTE_CONFERENCIA' }, include, orderBy: { dataMovimentacao: 'desc' } }),
    prisma.movimentacao.findMany({
      where: { tipo: 'REMETIDO', status: 'AGUARDANDO_CHEGADA' },
      include,
      orderBy: { id: 'desc' },
    }),
    prisma.movimentacao.findMany({
      where: { tipo: 'RECEBIMENTO', pesoSucataReal: null, grupos: { some: { tipoMaterial: 'SUCATA' } } },
      include,
      orderBy: { dataMovimentacao: 'desc' },
    }),
  ]);

  return { aguardandoConferencia, remetidosAguardandoChegada, recebidosAguardandoPesoSucata };
}
