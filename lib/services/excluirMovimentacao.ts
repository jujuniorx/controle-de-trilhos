import { prisma } from '@/lib/db';
import { ErroRegraNegocio } from '@/lib/services/errors';

/**
 * Exclui DEFINITIVAMENTE uma movimentação (recebimento ou remetido) e tudo que
 * pertence a ela: medições, grupos, anexos, histórico e detalhe de remetido.
 * Irreversível — pensado para limpar lançamentos de teste. Só o Administrativo chama.
 */
export async function excluirMovimentacao(movimentacaoId: string): Promise<{ rotulo: string; tipo: string }> {
  const mov = await prisma.movimentacao.findUnique({ where: { id: movimentacaoId } });
  if (!mov) throw new ErroRegraNegocio('Movimentação não encontrada (talvez já tenha sido excluída).');

  await prisma.$transaction([
    prisma.medicao.deleteMany({ where: { grupo: { movimentacaoId } } }),
    prisma.anexo.deleteMany({ where: { movimentacaoId } }),
    prisma.grupo.deleteMany({ where: { movimentacaoId } }),
    prisma.historicoAlteracao.deleteMany({ where: { movimentacaoId } }),
    prisma.remetidoDetalhe.deleteMany({ where: { movimentacaoId } }),
    prisma.movimentacao.delete({ where: { id: movimentacaoId } }),
  ]);

  return { rotulo: mov.numeroDocumento ? `NF ${mov.numeroDocumento}` : (mov.destino ?? mov.origem ?? mov.id), tipo: mov.tipo };
}
