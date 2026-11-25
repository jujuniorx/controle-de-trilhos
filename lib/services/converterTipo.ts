import { prisma } from '@/lib/db';
import { ErroRegraNegocio } from '@/lib/services/errors';

export type TipoConvertido = 'RECEBIMENTO' | 'REMETIDO';

const ROTULO: Record<TipoConvertido, string> = { RECEBIMENTO: 'recebimento', REMETIDO: 'remetido' };

/**
 * Admin: troca o tipo de uma movimentação já lançada (recebimento <-> remetido), no mesmo registro.
 * Medições, NF, placas e grupos ficam como estão; o relatório e as listas passam a contar o novo tipo.
 * O remetido ganha (ou perde) o detalhe de tipo de remetido. Tudo na mesma transação, com histórico.
 */
export async function converterTipoMovimentacao(
  id: string,
  destino: TipoConvertido,
  ator: { userId: string; nome: string },
): Promise<{ de: TipoConvertido; para: TipoConvertido }> {
  const mov = await prisma.movimentacao.findUnique({ where: { id }, select: { id: true, tipo: true } });
  if (!mov) throw new ErroRegraNegocio('Movimentação não encontrada (talvez já tenha sido excluída).');
  const de = mov.tipo as TipoConvertido;
  if (de === destino) throw new ErroRegraNegocio(`Essa movimentação já é ${ROTULO[destino]}.`);

  await prisma.$transaction(async (tx) => {
    await tx.movimentacao.update({ where: { id }, data: { tipo: destino } });
    if (destino === 'REMETIDO') {
      await tx.remetidoDetalhe.upsert({ where: { movimentacaoId: id }, create: { movimentacaoId: id }, update: {} });
    } else {
      await tx.remetidoDetalhe.deleteMany({ where: { movimentacaoId: id } });
    }
    await tx.historicoAlteracao.create({
      data: {
        movimentacaoId: id,
        usuarioId: ator.userId,
        usuarioNome: ator.nome,
        acao: 'TIPO_CONVERTIDO',
        campo: 'tipo',
        valorAntigo: de,
        valorNovo: destino,
      },
    });
  });
  return { de, para: destino };
}
