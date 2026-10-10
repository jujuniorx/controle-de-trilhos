'use server';

import { recebimentoCaminhaoSchema, type RecebimentoCaminhaoInput } from '@/lib/validation/recebimento';
import { criarRecebimentoCaminhao } from '@/lib/services/movimentacao';
import { requirePatioAcesso } from '@/lib/services/requirePatioAcesso';

export interface CriarRecebimentoResultado {
  ok: boolean;
  id?: string;
  erro?: string;
}

export async function criarRecebimento(input: unknown): Promise<CriarRecebimentoResultado> {
  await requirePatioAcesso();

  const parsed = recebimentoCaminhaoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: 'Dados inválidos. Revise os campos e tente novamente.' };
  }

  try {
    const movimentacao = await criarRecebimentoCaminhao(parsed.data as RecebimentoCaminhaoInput);
    return { ok: true, id: movimentacao.id };
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Erro ao salvar o recebimento.';
    return { ok: false, erro: mensagem };
  }
}
