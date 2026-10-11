'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revogarSessao } from '@/lib/services/auth';

/** Encerra a sessão: revoga no banco, apaga o cookie e volta para o login. */
export async function sairAction(): Promise<void> {
  const jar = await cookies();
  const token = jar.get('sessao_admin')?.value;
  if (token) {
    try {
      await revogarSessao(token);
    } catch {
      /* mesmo se falhar, o cookie sai e o acesso é encerrado neste aparelho */
    }
  }
  jar.delete('sessao_admin');
  redirect('/admin/login');
}
