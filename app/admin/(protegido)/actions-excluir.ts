'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { excluirMovimentacao } from '@/lib/services/excluirMovimentacao';
import { ErroRegraNegocio } from '@/lib/services/errors';

export async function excluirMovimentacaoAction(id: string): Promise<{ ok: boolean; erro?: string }> {
  await requireAdmin();
  try {
    await excluirMovimentacao(id);
  } catch (e) {
    if (e instanceof ErroRegraNegocio) return { ok: false, erro: e.message };
    return { ok: false, erro: 'Não foi possível excluir. Tente de novo.' };
  }
  revalidatePath('/admin', 'layout');
  return { ok: true };
}
