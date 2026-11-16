'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { ajustarBarrasDoDia } from '@/lib/services/producao';

export interface ResultadoAjuste {
  ok: boolean;
  erro?: string;
}

/** Barras soldadas a mais (cortadas depois): saem da conta do TLS do dia. */
export async function ajustarBarrasAction(_: ResultadoAjuste | undefined, formData: FormData): Promise<ResultadoAjuste> {
  await requireAdmin();
  const dataTexto = String(formData.get('data') ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataTexto)) return { ok: false, erro: 'Data inválida.' };
  const barras = Number(String(formData.get('barras') ?? '0').trim() || '0');
  if (!Number.isInteger(barras) || barras < 0 || barras > 12) return { ok: false, erro: 'Informe de 0 a 12 barras.' };
  const motivo = String(formData.get('motivo') ?? '').trim().slice(0, 200);
  if (barras > 0 && !motivo) return { ok: false, erro: 'Escreva o motivo.' };
  try {
    await ajustarBarrasDoDia(new Date(`${dataTexto}T00:00:00Z`), barras, motivo);
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Não foi possível salvar.' };
  }
  revalidatePath('/admin/producao');
  revalidatePath('/producao');
  return { ok: true };
}
