'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { ErroRegraNegocio } from '@/lib/services/errors';
import { adicionarNf, removerNfExtra } from '@/lib/services/notasFiscais';

export interface ResultadoNf {
  ok: boolean;
  erro?: string;
}

async function usuarioAtual() {
  const { userId } = await requireAdmin();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return { userId, nome: user.nome };
}

function mensagem(erro: unknown): string {
  return erro instanceof ErroRegraNegocio ? erro.message : 'Não foi possível salvar. Tente novamente.';
}

export async function adicionarNfAction(movimentacaoId: string, numero: string): Promise<ResultadoNf> {
  const usuario = await usuarioAtual();
  try {
    await adicionarNf(movimentacaoId, numero, usuario);
    revalidatePath('/admin', 'layout');
    return { ok: true };
  } catch (erro) {
    return { ok: false, erro: mensagem(erro) };
  }
}

export async function removerNfExtraAction(movimentacaoId: string, numero: string): Promise<ResultadoNf> {
  const usuario = await usuarioAtual();
  try {
    await removerNfExtra(movimentacaoId, numero, usuario);
    revalidatePath('/admin', 'layout');
    return { ok: true };
  } catch (erro) {
    return { ok: false, erro: mensagem(erro) };
  }
}
