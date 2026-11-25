'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { ajustarBarrasDoDia } from '@/lib/services/producao';

export interface ResultadoAjuste {
  ok: boolean;
  erro?: string;
}

/** Barras a mais (cortadas depois) saem da conta do TLS; barras a menos (não contadas) entram nela. */
export async function ajustarBarrasAction(_: ResultadoAjuste | undefined, formData: FormData): Promise<ResultadoAjuste> {
  await requireAdmin();
  const dataTexto = String(formData.get('data') ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataTexto)) return { ok: false, erro: 'Data inválida.' };
  const lerQuantidade = (campo: string) => Number(String(formData.get(campo) ?? '0').trim() || '0');
  const mais = lerQuantidade('mais');
  const menos = lerQuantidade('menos');
  for (const n of [mais, menos]) {
    if (!Number.isInteger(n) || n < 0 || n > 12) return { ok: false, erro: 'Informe de 0 a 12 barras.' };
  }
  if (mais > 0 && menos > 0) return { ok: false, erro: 'Informe só barras a mais ou só barras a menos.' };
  const barras = mais - menos;
  const motivo = String(formData.get('motivo') ?? '').trim().slice(0, 200);
  if (barras !== 0 && !motivo) return { ok: false, erro: 'Escreva o motivo.' };
  try {
    await ajustarBarrasDoDia(new Date(`${dataTexto}T00:00:00Z`), barras, motivo);
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Não foi possível salvar.' };
  }
  revalidatePath('/admin/producao');
  revalidatePath('/producao');
  return { ok: true };
}
