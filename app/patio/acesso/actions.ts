'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verificarPin, criarAcessoPatio } from '@/lib/services/patioAcesso';

export async function acessarPatio(formData: FormData): Promise<{ ok: boolean; erro?: string }> {
  const pin = String(formData.get('pin') ?? '');
  const valido = await verificarPin(pin);
  if (!valido) return { ok: false, erro: 'Código inválido.' };

  const { token, expiresAt } = await criarAcessoPatio();
  (await cookies()).set('acesso_patio', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  });

  redirect('/patio');
}

export async function acessarPatioAction(formData: FormData): Promise<void> {
  await acessarPatio(formData);
}
