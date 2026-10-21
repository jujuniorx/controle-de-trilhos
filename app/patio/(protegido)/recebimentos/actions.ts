'use server';

import { revalidatePath } from 'next/cache';
import { requirePatioAcesso } from '@/lib/services/requirePatioAcesso';
import { marcarChegadaCarregada, marcarChegadaDescarregada } from '@/lib/services/chegada';
import { ErroRegraNegocio } from '@/lib/services/errors';
import { excluirChegadaPatio } from '@/lib/services/chegada';
import { excluirRecebimentoPendentePatio } from '@/lib/services/excluirMovimentacao';

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

/** Pátio, carga e descarga: a carreta foi carregada (libera a saída). */
export async function marcarCarregadoAction(id: string): Promise<ResultadoRecebimentoPatio> {
  await requirePatioAcesso();
  try {
    await marcarChegadaCarregada(id, 'Pátio');
    revalidatePath('/patio');
    revalidatePath('/portaria');
    revalidatePath('/portaria/recebimentos');
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof ErroRegraNegocio ? e.message : 'Não foi possível concluir. Tente de novo.' };
  }
}

/** Pátio: exclui uma chegada da portaria (vai para a lixeira do dono, com motivo). */
export async function excluirChegadaPatioAction(id: string, motivo: string): Promise<ResultadoRecebimentoPatio> {
  await requirePatioAcesso();
  try {
    await excluirChegadaPatio(id, motivo, 'Pátio');
    revalidatePath('/patio');
    revalidatePath('/portaria');
    revalidatePath('/portaria/recebimentos');
    revalidatePath('/admin/lixeira');
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof ErroRegraNegocio ? e.message : 'Não foi possível excluir. Tente de novo.' };
  }
}

/** Pátio: exclui um recebimento pendente de conferência (vai para a lixeira do dono, com motivo). */
export async function excluirRecebimentoPendentePatioAction(movimentacaoId: string, motivo: string): Promise<ResultadoRecebimentoPatio> {
  await requirePatioAcesso();
  try {
    await excluirRecebimentoPendentePatio(movimentacaoId, motivo, 'Pátio');
    revalidatePath('/patio');
    revalidatePath('/portaria');
    revalidatePath('/portaria/recebimentos');
    revalidatePath('/admin', 'layout');
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof ErroRegraNegocio ? e.message : 'Não foi possível excluir. Tente de novo.' };
  }
}
