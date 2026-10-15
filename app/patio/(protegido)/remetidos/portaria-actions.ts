'use server';

import { revalidatePath } from 'next/cache';
import { requirePatioAcesso } from '@/lib/services/requirePatioAcesso';
import { desfazerLiberacaoCarreta, liberarCarreta } from '@/lib/services/portaria';
import { ErroRegraNegocio } from '@/lib/services/errors';

export interface ResultadoPortariaPatio {
  ok: boolean;
  erro?: string;
}

async function executar(fn: () => Promise<void>): Promise<ResultadoPortariaPatio> {
  await requirePatioAcesso();
  try {
    await fn();
    revalidatePath('/patio');
    revalidatePath('/patio/remetidos');
    revalidatePath('/portaria');
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof ErroRegraNegocio ? e.message : 'Não foi possível concluir. Tente de novo.' };
  }
}

/** Pátio: carregou e conferiu — libera a carreta para a Portaria deixar sair. */
export async function liberarCarretaAction(id: string): Promise<ResultadoPortariaPatio> {
  return executar(() => liberarCarreta(id));
}

export async function desfazerLiberacaoAction(id: string): Promise<ResultadoPortariaPatio> {
  return executar(() => desfazerLiberacaoCarreta(id));
}
