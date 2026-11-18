import { prisma } from '@/lib/db';
import { Decimal } from '@prisma/client/runtime/library';

interface UsuarioAcao {
  userId: string;
  nome: string;
}

/** Recalcula a metragem do grupo somando as medições que sobraram. */
async function recalcularGrupo(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], grupoId: string) {
  const medicoes = await tx.medicao.findMany({ where: { grupoId } });
  const metrosTotal = medicoes.reduce((acc, m) => acc + Number(m.metros), 0);
  await tx.grupo.update({ where: { id: grupoId }, data: { metrosTotal: new Decimal(Math.round(metrosTotal * 100) / 100) } });
}

/** Busca a medição garantindo que ela pertence ao recebimento informado. */
async function medicaoDoRecebimento(movimentacaoId: string, medicaoId: string) {
  const medicao = await prisma.medicao.findUnique({ where: { id: medicaoId }, include: { grupo: true } });
  if (!medicao || medicao.grupo.movimentacaoId !== movimentacaoId) {
    throw new Error('Medição não encontrada neste recebimento.');
  }
  return medicao;
}

/** Corrige quantidade e comprimento de uma medição. Fica registrado no histórico com o valor antigo e o novo. */
export async function editarMedicao(
  movimentacaoId: string,
  medicaoId: string,
  usuario: UsuarioAcao,
  novo: { quantidade: number; comprimento: number },
): Promise<void> {
  const atual = await medicaoDoRecebimento(movimentacaoId, medicaoId);
  const metros = Math.round(novo.quantidade * novo.comprimento * 100) / 100;
  const antes = `${atual.quantidade} × ${Number(atual.comprimento)} m`;
  const depois = `${novo.quantidade} × ${novo.comprimento} m`;
  await prisma.$transaction(async (tx) => {
    await tx.medicao.update({
      where: { id: medicaoId },
      data: { quantidade: novo.quantidade, comprimento: new Decimal(novo.comprimento), metros: new Decimal(metros) },
    });
    await recalcularGrupo(tx, atual.grupoId);
    await tx.historicoAlteracao.create({
      data: { movimentacaoId, usuarioId: usuario.userId, usuarioNome: usuario.nome, acao: 'MEDICAO_EDITADA', campo: 'medição', valorAntigo: antes, valorNovo: depois },
    });
  });
}

/** Apaga uma medição errada. Fica registrada no histórico com o que foi removido. */
export async function removerMedicao(movimentacaoId: string, medicaoId: string, usuario: UsuarioAcao): Promise<void> {
  const atual = await medicaoDoRecebimento(movimentacaoId, medicaoId);
  const antes = `${atual.quantidade} × ${Number(atual.comprimento)} m`;
  await prisma.$transaction(async (tx) => {
    await tx.medicao.delete({ where: { id: medicaoId } });
    await recalcularGrupo(tx, atual.grupoId);
    await tx.historicoAlteracao.create({
      data: { movimentacaoId, usuarioId: usuario.userId, usuarioNome: usuario.nome, acao: 'MEDICAO_REMOVIDA', campo: 'medição', valorAntigo: antes },
    });
  });
}
