import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { validarSessao } from '@/lib/services/auth';

/**
 * Portaria e Dono entram. O escritório (ADMIN) não entra na Portaria: é mandado de volta ao Administrativo.
 * Sem sessão válida volta para o login da Portaria.
 */
export async function requirePortaria(): Promise<{ userId: string; nome: string; role: 'DONO' | 'PORTARIA' }> {
  const token = (await cookies()).get('sessao_admin')?.value;
  const sessao = token ? await validarSessao(token) : null;
  if (!sessao) redirect('/portaria/login');
  if (sessao.role === 'ADMIN') redirect('/admin');
  return { ...sessao, role: sessao.role };
}
