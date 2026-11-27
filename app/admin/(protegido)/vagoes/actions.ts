'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { registrarAuditoria } from '@/lib/services/auditoria';
import { ErroRegraNegocio } from '@/lib/services/errors';
import { criarRemetidoVagao, definirMovimentaEstoque } from '@/lib/services/vagaoRemetido';
import { remetidoVagaoSchema } from '@/lib/validation/vagaoRemetido';

export interface ResultadoVagaoAdmin {
  ok: boolean;
  erro?: string;
  id?: string;
}

function atualizarTelas() {
  revalidatePath('/admin', 'layout');
}

export async function lancarRemetidoVagaoAction(input: unknown): Promise<ResultadoVagaoAdmin> {
  const sessao = await requireAdmin();
  const parsed = remetidoVagaoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erro: parsed.error.issues[0]?.message ?? 'Revise os campos.' };
  try {
    const id = await criarRemetidoVagao(parsed.data, sessao);
    const tls = parsed.data.linhas.reduce((t, l) => t + l.quantidade, 0);
    await registrarAuditoria(
      sessao,
      'Remetido de vagão',
      `Trilheiro ${parsed.data.trilheiro} · ${tls} TLS · ${parsed.data.destino}${parsed.data.movimentaEstoque ? '' : ' · sem mexer no estoque'}`,
    );
    atualizarTelas();
    return { ok: true, id };
  } catch (e) {
    if (e instanceof ErroRegraNegocio) return { ok: false, erro: e.message };
    console.error('Falha ao lançar remetido de vagão', e);
    return { ok: false, erro: 'Não foi possível lançar o remetido. Nada foi gravado. Tente de novo.' };
  }
}

export async function definirMovimentaEstoqueAction(id: string, movimenta: boolean): Promise<ResultadoVagaoAdmin> {
  const sessao = await requireAdmin();
  try {
    await definirMovimentaEstoque(id, movimenta, sessao);
    atualizarTelas();
    return { ok: true };
  } catch (e) {
    if (e instanceof ErroRegraNegocio) return { ok: false, erro: e.message };
    console.error('Falha ao alterar a saída do estoque', e);
    return { ok: false, erro: 'Não foi possível alterar. Tente de novo.' };
  }
}
