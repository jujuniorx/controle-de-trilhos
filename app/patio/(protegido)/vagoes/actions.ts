'use server';

import { revalidatePath } from 'next/cache';
import { criarChegadaVagao } from '@/lib/services/movimentacao';
import { requirePatioAcesso } from '@/lib/services/requirePatioAcesso';
import { chegadaVagaoSchema } from '@/lib/validation/vagao';

export interface ResultadoVagao {
  ok: boolean;
  erro?: string;
}

export async function criarChegadaVagaoAction(input: unknown): Promise<ResultadoVagao> {
  await requirePatioAcesso();
  const parsed = chegadaVagaoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erro: parsed.error.issues[0]?.message ?? 'Revise os campos.' };
  try {
    await criarChegadaVagao(parsed.data);
    revalidatePath('/admin', 'layout');
    return { ok: true };
  } catch (erro) {
    console.error('Erro ao registrar chegada de vagão:', erro);
    return { ok: false, erro: 'Não foi possível registrar o vagão. Tente de novo.' };
  }
}
