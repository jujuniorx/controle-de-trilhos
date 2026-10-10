'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { registrarAuditoria } from '@/lib/services/auditoria';
import { excluirMovimentacao } from '@/lib/services/excluirMovimentacao';
import { ErroRegraNegocio } from '@/lib/services/errors';

export async function excluirMovimentacaoAction(id: string): Promise<{ ok: boolean; erro?: string }> {
  const sessao = await requireAdmin();
  if (sessao.role !== 'DONO') return { ok: false, erro: 'Só o dono do sistema pode excluir movimentações.' };
  try {
    const { rotulo, tipo } = await excluirMovimentacao(id);
    await registrarAuditoria(sessao, 'Exclusão de movimentação', `${tipo === 'RECEBIMENTO' ? 'Recebimento' : 'Remetido'} ${rotulo}`);
  } catch (e) {
    if (e instanceof ErroRegraNegocio) return { ok: false, erro: e.message };
    return { ok: false, erro: 'Não foi possível excluir. Tente de novo.' };
  }
  revalidatePath('/admin', 'layout');
  return { ok: true };
}
