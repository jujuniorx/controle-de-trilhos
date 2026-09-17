'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { autenticar } from '@/lib/services/loginService';

export async function login(formData: FormData): Promise<{ ok: boolean; erro?: string }> {
  const email = String(formData.get('email') ?? '');
  const senha = String(formData.get('senha') ?? '');

  const resultado = await autenticar(email, senha);
  if (!resultado.ok || !resultado.token || !resultado.expiresAt) {
    return { ok: false, erro: resultado.erro };
  }

  (await cookies()).set('sessao_admin', resultado.token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    expires: resultado.expiresAt,
    path: '/',
  });

  redirect('/admin');
}

export async function loginAction(formData: FormData): Promise<void> {
  await login(formData);
}
