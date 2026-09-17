import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { validarSessao } from '@/lib/services/auth';

export async function requireAdmin(): Promise<{ userId: string }> {
  const token = (await cookies()).get('sessao_admin')?.value;
  const sessao = token ? await validarSessao(token) : null;
  if (!sessao) redirect('/admin/login');
  return sessao;
}
