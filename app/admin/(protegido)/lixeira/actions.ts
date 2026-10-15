'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { registrarAuditoria } from '@/lib/services/auditoria';
import { restaurarMovimentacao } from '@/lib/services/lixeira';
import { ErroRegraNegocio } from '@/lib/services/errors';

export async function restaurarMovimentacaoAction(lixeiraId: string): Promise<{ ok: boolean; erro?: string; irPara?: string }> {
  const sessao = await requireAdmin();
  if (sessao.role !== 'DONO') return { ok: false, erro: 'Só o dono do sistema pode restaurar movimentações.' };
  let resultado: Awaited<ReturnType<typeof restaurarMovimentacao>>;
  try {
    resultado = await restaurarMovimentacao(lixeiraId, sessao);
  } catch (e) {
    if (e instanceof ErroRegraNegocio) return { ok: false, erro: e.message };
    console.error('Falha ao restaurar movimentação', e);
    return { ok: false, erro: 'Não foi possível restaurar. Tente de novo.' };
  }
  await registrarAuditoria(
    sessao,
    'Restauração de movimentação',
    `${resultado.tipo === 'RECEBIMENTO' ? 'Recebimento' : 'Remetido'} ${resultado.rotulo}`,
  );
  revalidatePath('/admin', 'layout');
  const base = resultado.tipo === 'RECEBIMENTO' ? 'recebimentos' : 'remetidos';
  return { ok: true, irPara: `/admin/${base}/${resultado.movimentacaoId}` };
}
