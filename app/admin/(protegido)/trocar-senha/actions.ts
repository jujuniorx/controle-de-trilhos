'use server';

import { requireAdmin } from '@/lib/services/requireAdmin';
import { trocarSenha } from '@/lib/services/auth';
import { trocarSenhaSchema } from '@/lib/validation/auth';

export interface EstadoTrocarSenha {
  erro?: string;
  sucesso?: boolean;
}

export async function trocarSenhaAction(
  _estadoAnterior: EstadoTrocarSenha,
  formData: FormData,
): Promise<EstadoTrocarSenha> {
  const { userId } = await requireAdmin();

  const parsed = trocarSenhaSchema.safeParse({
    senhaAtual: String(formData.get('senhaAtual') ?? ''),
    novaSenha: String(formData.get('novaSenha') ?? ''),
    confirmacao: String(formData.get('confirmacao') ?? ''),
  });
  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  const resultado = await trocarSenha(userId, parsed.data.senhaAtual, parsed.data.novaSenha);
  if (!resultado.ok) {
    return { erro: resultado.erro };
  }

  return { sucesso: true };
}
