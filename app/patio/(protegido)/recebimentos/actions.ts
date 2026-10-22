'use server';

import { revalidatePath } from 'next/cache';
import { requirePatioAcesso } from '@/lib/services/requirePatioAcesso';
import { marcarChegadaDescarregada } from '@/lib/services/chegada';
import { ErroRegraNegocio } from '@/lib/services/errors';

export interface ResultadoRecebimentoPatio {
  ok: boolean;
  erro?: string;
}

/** Pátio: os trilhos foram descarregados; libera a saída do caminhão e deixa a medição para depois. */
export async function marcarDescarregadoAction(id: string): Promise<ResultadoRecebimentoPatio> {
  await requirePatioAcesso();
  try {
    await marcarChegadaDescarregada(id, 'Pátio');
    revalidatePath('/patio');
    revalidatePath('/portaria');
    revalidatePath('/portaria/recebimentos');
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof ErroRegraNegocio ? e.message : 'Não foi possível concluir. Tente de novo.' };
  }
}
