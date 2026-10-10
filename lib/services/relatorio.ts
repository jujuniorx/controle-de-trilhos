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

/**
 * Peso de um grupo para fins de relatório. SUCATA de Recebimento é tratada
 * fora desta função (ver pesoMovimentacao) porque seu peso real vive em
 * Movimentacao.pesoSucataReal, não no grupo — nunca pode se somar aos dois ao
 * mesmo tempo. Precedência informado > calculado, igual a todo o resto do
 * código que resolve o peso conhecido de um grupo de Remetido (ver
 * resumoPesoRemetido em lib/services/remetido.ts e o export Excel) — para
 * grupos de RECEBIMENTO é um no-op, já que pesoInformado nunca é gravado por
 * criarRecebimentoCaminhao (lib/services/movimentacao.ts).
 */
export function pesoConhecidoDoGrupo(grupo: MovimentacaoRelatorio['grupos'][number]): number {
  return Number(grupo.pesoInformado ?? grupo.pesoCalculado ?? 0);
}

/**
 * Peso total de UMA movimentação. Replica a precedência já usada em
 * resumoPeso() (lib/services/movimentacao.ts): para SUCATA de Recebimento,
 * o peso real (pesoSucataReal) substitui a estimativa do grupo quando
 * presente — nunca soma os dois (bug corrigido na Task 7). Enquanto
 * pendente, a estimativa fica misturada ao total sem rótulo específico
 * nesta tela.
 */
export function pesoMovimentacao(mov: MovimentacaoRelatorio): number {
  let total = 0;
  for (const grupo of mov.grupos) {
    if (mov.tipo === 'RECEBIMENTO' && grupo.tipoMaterial === 'SUCATA') {
      if (mov.pesoSucataReal == null) total += pesoConhecidoDoGrupo(grupo);
      continue;
    }
    total += pesoConhecidoDoGrupo(grupo);
  }
  if (mov.tipo === 'RECEBIMENTO' && mov.pesoSucataReal != null) {
    total += Number(mov.pesoSucataReal);
  }
  return total;
}

export function resumoRelatorio(movimentacoes: MovimentacaoRelatorio[]): ResumoRelatorio {
  let pecas = 0;
  let metros = 0;
  let toneladas = 0;

  for (const mov of movimentacoes) {
    for (const grupo of mov.grupos) {
      for (const medicao of grupo.medicoes) pecas += medicao.quantidade;
      metros += Number(grupo.metrosTotal);
    }
    toneladas += pesoMovimentacao(mov);
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
