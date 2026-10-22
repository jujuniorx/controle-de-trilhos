'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { registrarAuditoria } from '@/lib/services/auditoria';
import { restaurarChegada, restaurarMovimentacao } from '@/lib/services/lixeira';
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

/** Dono: recoloca uma chegada que o Pátio excluiu (volta para a lista da Portaria e do Pátio). */
export async function restaurarChegadaAction(chegadaId: string): Promise<{ ok: boolean; erro?: string }> {
  const sessao = await requireAdmin();
  if (sessao.role !== 'DONO') return { ok: false, erro: 'Só o dono do sistema pode restaurar.' };
  try {
    await restaurarChegada(chegadaId);
  } catch (e) {
    if (e instanceof ErroRegraNegocio) return { ok: false, erro: e.message };
    console.error('Falha ao restaurar chegada', e);
    return { ok: false, erro: 'Não foi possível restaurar. Tente de novo.' };
  }
  await registrarAuditoria(sessao, 'Restauração de chegada', 'Chegada da portaria restaurada da lixeira');
  revalidatePath('/admin', 'layout');
  revalidatePath('/patio');
  revalidatePath('/portaria');
  return { ok: true };
}
