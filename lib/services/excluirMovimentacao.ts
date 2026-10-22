import { prisma } from '@/lib/db';
import { ErroRegraNegocio } from '@/lib/services/errors';
import { rotuloDaMovimentacao, tirarSnapshot } from '@/lib/services/lixeira';

/**
 * Exclui uma movimentação (recebimento ou remetido) e tudo que pertence a ela: medições,
 * grupos, anexos, histórico e detalhe de remetido. Antes de apagar, guarda uma cópia
 * completa na lixeira — assim dá para restaurar em /admin/lixeira. Se a cópia não puder
 * ser guardada, NADA é apagado (é tudo na mesma transação). Só o dono chama.
 */
export async function excluirMovimentacao(
  movimentacaoId: string,
  ator: { userId: string; nome: string },
): Promise<{ rotulo: string; tipo: string }> {
  const foto = await tirarSnapshot(movimentacaoId);
  if (!foto) throw new ErroRegraNegocio('Movimentação não encontrada (talvez já tenha sido excluída).');
  const { mov, json } = foto;
  const rotulo = rotuloDaMovimentacao(mov);

  await prisma.$transaction([
    prisma.movimentacaoExcluida.create({
      data: {
        movimentacaoId: mov.id,
        tipo: mov.tipo,
        rotulo,
        dados: json,
        excluidoPorId: ator.userId,
        excluidoPorNome: ator.nome,
      },
    }),
    prisma.medicao.deleteMany({ where: { grupo: { movimentacaoId } } }),
    prisma.anexo.deleteMany({ where: { movimentacaoId } }),
    prisma.grupo.deleteMany({ where: { movimentacaoId } }),
    prisma.historicoAlteracao.deleteMany({ where: { movimentacaoId } }),
    prisma.remetidoDetalhe.deleteMany({ where: { movimentacaoId } }),
    prisma.movimentacao.delete({ where: { id: movimentacaoId } }),
  ]);

  return { rotulo, tipo: mov.tipo };
}
