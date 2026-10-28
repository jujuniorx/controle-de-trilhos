'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { registrarAuditoria } from '@/lib/services/auditoria';
import { excluirMovimentacao } from '@/lib/services/excluirMovimentacao';
import { ErroRegraNegocio } from '@/lib/services/errors';

export async function excluirMovimentacaoAction(id: string, motivo: string): Promise<{ ok: boolean; erro?: string }> {
  const sessao = await requireAdmin();
  const motivoLimpo = (motivo ?? '').trim();
  if (motivoLimpo.length < 3) return { ok: false, erro: 'Escreva o motivo da exclusão (pelo menos 3 letras).' };
  try {
    const { rotulo, tipo } = await excluirMovimentacao(id, sessao);
    await registrarAuditoria(
      sessao,
      'Exclusão de movimentação',
      `${tipo === 'RECEBIMENTO' ? 'Recebimento' : 'Remetido'} ${rotulo} foi para a Lixeira · Motivo: “${motivoLimpo}”`,
    );
  } catch (e) {
    if (e instanceof ErroRegraNegocio) return { ok: false, erro: e.message };
    console.error('Falha ao excluir movimentação', e);
    return {
      ok: false,
      erro: 'Não foi possível excluir. Nada foi apagado. Se isso continuar, as migrações do banco (lixeira) podem estar pendentes.',
    };
  }
  revalidatePath('/admin', 'layout');
  return { ok: true };
}
