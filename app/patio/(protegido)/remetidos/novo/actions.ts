'use server';

import { lancamentoDiretoRemetidoSchema } from '@/lib/validation/remetido';
import { criarRemetidoDireto } from '@/lib/services/remetido';
import { requirePatioAcesso } from '@/lib/services/requirePatioAcesso';

export interface CriarRemetidoDiretoResultado {
  ok: boolean;
  erro?: string;
}

export async function criarRemetidoDiretoAction(input: unknown): Promise<CriarRemetidoDiretoResultado> {
  await requirePatioAcesso();

  const parsed = lancamentoDiretoRemetidoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: 'Dados inválidos. Revise os campos e tente novamente.' };
  }

  try {
    await criarRemetidoDireto(crypto.randomUUID(), parsed.data);
    return { ok: true };
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Erro ao lançar o remetido.';
    return { ok: false, erro: mensagem };
  }
}
