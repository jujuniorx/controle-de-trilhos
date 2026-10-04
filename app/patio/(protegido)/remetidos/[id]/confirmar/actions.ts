'use server';

import { confirmacaoRemetidoSchema, type ConfirmacaoRemetidoInput } from '@/lib/validation/remetido';
import { confirmarRemetido } from '@/lib/services/remetido';
import { requirePatioAcesso } from '@/lib/services/requirePatioAcesso';

export interface ConfirmarRemetidoResultado {
  ok: boolean;
  erro?: string;
}

export async function confirmarRemetidoAction(movimentacaoId: string, input: unknown): Promise<ConfirmarRemetidoResultado> {
  await requirePatioAcesso();

  const parsed = confirmacaoRemetidoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: 'Dados inválidos. Revise os campos e tente novamente.' };
  }

  try {
    await confirmarRemetido(movimentacaoId, parsed.data as ConfirmacaoRemetidoInput);
    return { ok: true };
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Erro ao confirmar o remetido.';
    return { ok: false, erro: mensagem };
  }
}
