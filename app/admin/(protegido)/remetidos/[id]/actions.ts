'use server';

import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/services/requireAdmin';
import {
  informarNumeroDocumentoRemetido,
  informarPesoGrupoRemetido,
  informarTipoRemetido,
  atualizarRemetido,
} from '@/lib/services/remetido';
import { lancamentoDiretoRemetidoSchema } from '@/lib/validation/remetido';
import { ErroRegraNegocio } from '@/lib/services/errors';
import { NF_REGEX, MSG_NF_INVALIDA } from '@/lib/validation/recebimento';

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
  if (!NF_REGEX.test(numeroDocumento)) {
    return { ok: false, erro: MSG_NF_INVALIDA };
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

export async function informarTipoRemetidoAction(
  movimentacaoId: string,
  tipoRemetido: string,
): Promise<AcaoResultado> {
  if (!['VENDA', 'TRANS', 'INDUS'].includes(tipoRemetido)) {
    return { ok: false, erro: 'Selecione o tipo de remetido.' };
  }

  const usuario = await usuarioAtual();
  try {
    await informarTipoRemetido(movimentacaoId, tipoRemetido as 'VENDA' | 'TRANS' | 'INDUS', usuario);
    return { ok: true };
  } catch (erro) {
    const mensagem = erro instanceof ErroRegraNegocio ? erro.message : 'Não foi possível salvar o tipo de remetido.';
    return { ok: false, erro: mensagem };
  }
}

export async function atualizarRemetidoAction(movimentacaoId: string, input: unknown): Promise<AcaoResultado> {
  const usuario = await usuarioAtual();

  const parsed = lancamentoDiretoRemetidoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: 'Dados inválidos. Revise os campos e tente novamente.' };
  }

  try {
    await atualizarRemetido(movimentacaoId, parsed.data, usuario);
    return { ok: true };
  } catch (erro) {
    const mensagem = erro instanceof ErroRegraNegocio ? erro.message : 'Não foi possível salvar as alterações.';
    return { ok: false, erro: mensagem };
  }
}
