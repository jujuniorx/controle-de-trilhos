'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { registrarAuditoria } from '@/lib/services/auditoria';
import { converterTipoMovimentacao, type TipoConvertido } from '@/lib/services/converterTipo';
import { ErroRegraNegocio } from '@/lib/services/errors';

/** Só o Administrativo converte o tipo (recebimento <-> remetido), com motivo obrigatório. */
export async function converterTipoAction(
  id: string,
  destino: TipoConvertido,
  motivo: string,
): Promise<{ ok: boolean; erro?: string }> {
  const sessao = await requireAdmin();
  if (destino !== 'RECEBIMENTO' && destino !== 'REMETIDO') return { ok: false, erro: 'Tipo inválido.' };
  const motivoLimpo = (motivo ?? '').trim().slice(0, 200);
  if (motivoLimpo.length < 10) return { ok: false, erro: 'Escreva o motivo com pelo menos 10 letras.' };
  try {
    const { de, para } = await converterTipoMovimentacao(id, destino, sessao);
    await registrarAuditoria(
      sessao,
      'Conversão de tipo',
      `Movimentação de ${de === 'RECEBIMENTO' ? 'recebimento' : 'remetido'} para ${para === 'REMETIDO' ? 'remetido' : 'recebimento'} · Motivo: “${motivoLimpo}”`,
    );
  } catch (e) {
    if (e instanceof ErroRegraNegocio) return { ok: false, erro: e.message };
    console.error('Falha ao converter tipo da movimentação', e);
    return { ok: false, erro: 'Não foi possível converter. Nada foi alterado.' };
  }
  revalidatePath('/admin', 'layout');
  return { ok: true };
}
