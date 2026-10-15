'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { autenticar } from '@/lib/services/loginService';

export interface EstadoLoginPortaria {
  erro?: string;
}

export async function loginPortariaAction(_anterior: EstadoLoginPortaria, formData: FormData): Promise<EstadoLoginPortaria> {
  const resultado = await autenticar(String(formData.get('identificador') ?? ''), String(formData.get('senha') ?? ''));
  if (!resultado.ok || !resultado.token || !resultado.expiresAt) {
    return { erro: resultado.erro ?? 'Não foi possível entrar. Tente novamente.' };
  }
  (await cookies()).set('sessao_admin', resultado.token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    expires: resultado.expiresAt,
    path: '/',
  });
  redirect('/portaria');
}
