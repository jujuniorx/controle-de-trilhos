'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { concluirLoginComCodigo } from '@/lib/services/loginService';
import { lerPasse2fa } from '@/lib/services/segredo2fa';

export interface EstadoCodigo {
  erro?: string;
}

export async function codigoAction(_anterior: EstadoCodigo, formData: FormData): Promise<EstadoCodigo> {
  const jar = await cookies();
  const userId = lerPasse2fa(jar.get('login_2fa')?.value);
  if (!userId) {
    redirect('/admin/login');
  }

  const resultado = await concluirLoginComCodigo(userId, String(formData.get('codigo') ?? ''));
  if (!resultado.ok || !resultado.token || !resultado.expiresAt) {
    return { erro: resultado.erro ?? 'Não foi possível entrar. Tente novamente.' };
  }

  jar.delete({ name: 'login_2fa', path: '/admin/login' });
  jar.set('sessao_admin', resultado.token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    expires: resultado.expiresAt,
    path: '/',
  });
  redirect('/admin');
}
