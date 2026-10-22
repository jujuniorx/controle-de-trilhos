import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { validarSessao } from '@/lib/services/auth';

/** Portaria, Administrativo e Dono entram; sem sessão válida volta para o login da Portaria. */
export async function requirePortaria(): Promise<{ userId: string; nome: string; role: 'ADMIN' | 'DONO' | 'PORTARIA' }> {
  const token = (await cookies()).get('sessao_admin')?.value;
  const sessao = token ? await validarSessao(token) : null;
  if (!sessao) redirect('/portaria/login');
  return sessao;
}
