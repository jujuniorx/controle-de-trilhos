'use server';

import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { preCadastroRemetidoSchema } from '@/lib/validation/remetido';
import { criarPreCadastroRemetido } from '@/lib/services/remetido';

export interface EstadoPreCadastroRemetido {
  erro?: string;
}

export async function criarPreCadastroRemetidoAction(
  _estadoAnterior: EstadoPreCadastroRemetido,
  formData: FormData,
): Promise<EstadoPreCadastroRemetido> {
  await requireAdmin();

  const numeroDocumento = String(formData.get('numeroDocumento') ?? '').trim();
  const parsed = preCadastroRemetidoSchema.safeParse({
    tipoRemetido: formData.get('tipoRemetido'),
    reservaPedido: formData.get('reservaPedido'),
    destino: formData.get('destino'),
    numeroDocumento: numeroDocumento || undefined,
  });

  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? 'Dados inválidos. Revise os campos.' };
  }

  const movimentacao = await criarPreCadastroRemetido(crypto.randomUUID(), parsed.data);
  redirect(`/admin/remetidos/${movimentacao.id}`);
}
