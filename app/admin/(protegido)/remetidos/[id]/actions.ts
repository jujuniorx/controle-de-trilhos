'use server';

import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { informarNumeroDocumentoRemetido, informarPesoGrupoRemetido } from '@/lib/services/remetido';
import { ErroRegraNegocio } from '@/lib/services/errors';

export interface AcaoResultado {
  ok: boolean;
  erro?: string;
}

async function usuarioAtual() {
  const { userId } = await requireAdmin();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return { userId, nome: user.nome };
}

export async function informarNumeroDocumentoAction(movimentacaoId: string, numeroDocumento: string): Promise<AcaoResultado> {
  if (!/^\d{1,9}$/.test(numeroDocumento)) {
    return { ok: false, erro: 'Informe a nota fiscal, somente números.' };
  }

  const usuario = await usuarioAtual();
  try {
    await informarNumeroDocumentoRemetido(movimentacaoId, numeroDocumento, usuario);
    return { ok: true };
  } catch (erro) {
    const mensagem = erro instanceof ErroRegraNegocio ? erro.message : 'Não foi possível salvar a nota fiscal.';
    return { ok: false, erro: mensagem };
  }
}

export async function informarPesoGrupoAction(grupoId: string, peso: number): Promise<AcaoResultado> {
  if (!Number.isFinite(peso) || peso <= 0) {
    return { ok: false, erro: 'Informe um peso válido, maior que zero.' };
  }

  const usuario = await usuarioAtual();
  try {
    await informarPesoGrupoRemetido(grupoId, peso, usuario);
    return { ok: true };
  } catch (erro) {
    const mensagem = erro instanceof ErroRegraNegocio ? erro.message : 'Não foi possível salvar o peso.';
    return { ok: false, erro: mensagem };
  }
}
