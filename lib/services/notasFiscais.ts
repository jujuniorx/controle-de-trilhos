import { prisma } from '@/lib/db';
import { ErroRegraNegocio } from '@/lib/services/errors';
import { NF_REGEX, MSG_NF_INVALIDA } from '@/lib/validation/recebimento';
import { todasAsNfs } from '@/lib/nf';

export interface UsuarioNf {
  userId: string;
  nome: string;
}

/**
 * Carregamento com mais de uma NF. A primeira fica em `numeroDocumento` (é o que o resto do sistema
 * já usa); as demais ficam em `numerosDocumentoExtras`. Qualquer usuário do Escritório pode
 * adicionar ou tirar — Remetido ou Recebimento, conferido ou não (não reabre a conferência: a
 * NF extra não muda pesos nem medidas; fica tudo no histórico).
 */
export async function adicionarNf(movimentacaoId: string, numero: string, usuario: UsuarioNf): Promise<void> {
  const nf = numero.trim();
  if (!NF_REGEX.test(nf)) throw new ErroRegraNegocio(MSG_NF_INVALIDA);

  const mov = await prisma.movimentacao.findUnique({ where: { id: movimentacaoId } });
  if (!mov) throw new ErroRegraNegocio('Movimentação não encontrada.');
  if (todasAsNfs(mov).includes(nf)) throw new ErroRegraNegocio(`A NF ${nf} já está neste carregamento.`);

  await prisma.$transaction(async (tx) => {
    // Sem NF principal ainda: a nova vira a principal (libera a conferência, como o campo "NF em aberto").
    if (mov.numeroDocumento == null) {
      await tx.movimentacao.update({ where: { id: movimentacaoId }, data: { numeroDocumento: nf } });
    } else {
      await tx.movimentacao.update({
        where: { id: movimentacaoId },
        data: { numerosDocumentoExtras: { push: nf } },
      });
    }
    await tx.historicoAlteracao.create({
      data: {
        movimentacaoId,
        usuarioId: usuario.userId,
        usuarioNome: usuario.nome,
        acao: 'NF_ADICIONADA',
        campo: 'numerosDocumentoExtras',
        valorAntigo: todasAsNfs(mov).join(', ') || null,
        valorNovo: nf,
      },
    });
  });
}

/** Tira uma NF EXTRA (a principal só pode ser corrigida, não removida). */
export async function removerNfExtra(movimentacaoId: string, numero: string, usuario: UsuarioNf): Promise<void> {
  const mov = await prisma.movimentacao.findUnique({ where: { id: movimentacaoId } });
  if (!mov) throw new ErroRegraNegocio('Movimentação não encontrada.');
  if (!mov.numerosDocumentoExtras.includes(numero)) throw new ErroRegraNegocio('Essa NF não está na lista de NFs extras.');

  await prisma.$transaction(async (tx) => {
    await tx.movimentacao.update({
      where: { id: movimentacaoId },
      data: { numerosDocumentoExtras: mov.numerosDocumentoExtras.filter((n) => n !== numero) },
    });
    await tx.historicoAlteracao.create({
      data: {
        movimentacaoId,
        usuarioId: usuario.userId,
        usuarioNome: usuario.nome,
        acao: 'NF_REMOVIDA',
        campo: 'numerosDocumentoExtras',
        valorAntigo: numero,
        valorNovo: null,
      },
    });
  });
}
