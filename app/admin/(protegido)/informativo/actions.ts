'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { ehIsoValido } from '@/lib/usina/periodo';

export interface ResultadoRecolhimento {
  ok: boolean;
  erro?: string;
}

/** Barras recolhidas no dia (W61 ou W62). Em branco = 0. Só mexe em `barras`; jacarés e observação ficam como estão. */
export async function salvarRecolhimentoDiaAction(
  _: ResultadoRecolhimento | undefined,
  formData: FormData,
): Promise<ResultadoRecolhimento> {
  await requireAdmin();
  const data = String(formData.get('data') ?? '');
  if (!ehIsoValido(data)) return { ok: false, erro: 'Data inválida.' };

  const ativos = ['W61', 'W62'] as const;
  const valores: Record<(typeof ativos)[number], number> = { W61: 0, W62: 0 };
  for (const ativo of ativos) {
    const s = String(formData.get(`barras_${ativo}`) ?? '').trim();
    if (s === '') continue;
    if (!/^\d{1,6}$/.test(s)) return { ok: false, erro: 'Use só números inteiros em barras.' };
    valores[ativo] = Number(s);
  }

  const dia = new Date(`${data}T00:00:00Z`);
  await prisma.$transaction(
    ativos.map((ativo) =>
      prisma.composicaoDia.upsert({
        where: { data_ativo: { data: dia, ativo } },
        update: { barras: valores[ativo] },
        create: { data: dia, ativo, barras: valores[ativo] },
      }),
    ),
  );

  revalidatePath('/admin/informativo');
  revalidatePath('/admin/usina');
  return { ok: true };
}
