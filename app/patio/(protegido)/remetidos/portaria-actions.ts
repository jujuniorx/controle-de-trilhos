'use server';

import { revalidatePath } from 'next/cache';
import { requirePatioAcesso } from '@/lib/services/requirePatioAcesso';
import { concluirMedicao, reabrirMedicao } from '@/lib/services/portaria';
import { ErroRegraNegocio } from '@/lib/services/errors';

export interface ResultadoPortariaPatio {
  ok: boolean;
  erro?: string;
}

async function executar(fn: () => Promise<void>): Promise<ResultadoPortariaPatio> {
  await requirePatioAcesso();
  try {
    await fn();
    revalidatePath('/patio/remetidos');
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof ErroRegraNegocio ? e.message : 'Não foi possível concluir. Tente de novo.' };
  }
}

export async function concluirMedicaoAction(id: string): Promise<ResultadoPortariaPatio> {
  return executar(() => concluirMedicao(id));
}

export async function reabrirMedicaoAction(id: string): Promise<ResultadoPortariaPatio> {
  return executar(() => reabrirMedicao(id));
}
