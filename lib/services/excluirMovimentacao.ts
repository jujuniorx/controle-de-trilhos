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
  ator: { userId: string | null; nome: string },
  opcoes: { motivo?: string; chegadaId?: string } = {},
): Promise<{ rotulo: string; tipo: string }> {
  const foto = await tirarSnapshot(movimentacaoId);
  if (!foto) throw new ErroRegraNegocio('Movimentação não encontrada (talvez já tenha sido excluída).');
  const { mov, json } = foto;
  const rotulo = rotuloDaMovimentacao(mov);
  // Chegada de onde veio o recebimento: fica guardada na lixeira para religar ao restaurar.
  const dados = opcoes.chegadaId ? { ...(json as object), chegadaIdOrigem: opcoes.chegadaId } : json;

  await prisma.$transaction([
    prisma.movimentacaoExcluida.create({
      data: {
        movimentacaoId: mov.id,
        tipo: mov.tipo,
        rotulo,
        dados: dados as object,
        excluidoPorId: ator.userId,
        excluidoPorNome: ator.nome,
        motivo: opcoes.motivo ?? null,
      },
    }),
    ...(opcoes.chegadaId
      ? [prisma.chegadaCaminhao.updateMany({ where: { id: opcoes.chegadaId, movimentacaoId }, data: { movimentacaoId: null, recebidaEm: null } })]
      : []),
    prisma.medicao.deleteMany({ where: { grupo: { movimentacaoId } } }),
    prisma.anexo.deleteMany({ where: { movimentacaoId } }),
    prisma.grupo.deleteMany({ where: { movimentacaoId } }),
    prisma.historicoAlteracao.deleteMany({ where: { movimentacaoId } }),
    prisma.remetidoDetalhe.deleteMany({ where: { movimentacaoId } }),
    prisma.movimentacao.delete({ where: { id: movimentacaoId } }),
  ]);

  return { rotulo, tipo: mov.tipo };
}

/**
 * Pátio: exclui uma carreta de remetido que a Portaria registrou e ainda não foi liberada/saiu.
 * Motivo obrigatório; vai para a lixeira do dono (restaurável).
 */
export async function excluirRemetidoPatio(movimentacaoId: string, motivo: string, atorNome: string): Promise<void> {
  const texto = motivo.trim();
  if (texto.length < 10) throw new ErroRegraNegocio('Escreva o motivo da exclusão com pelo menos 10 letras (ex.: "carga cancelada pelo cliente").');
  const mov = await prisma.movimentacao.findUnique({
    where: { id: movimentacaoId },
    select: { tipo: true, carretaLiberadaEm: true, saidaPortariaEm: true },
  });
  if (!mov) throw new ErroRegraNegocio('Remetido não encontrado (talvez já tenha sido excluído).');
  if (mov.tipo !== 'REMETIDO') throw new ErroRegraNegocio('Este registro não é um remetido.');
  if (mov.carretaLiberadaEm || mov.saidaPortariaEm) {
    throw new ErroRegraNegocio('Esta carreta já foi liberada ou já saiu. Não dá para excluir.');
  }
  await excluirMovimentacao(movimentacaoId, { userId: null, nome: atorNome }, { motivo: texto });
}
