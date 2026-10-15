import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { validarSessao } from '@/lib/services/auth';

export async function requireAdmin(): Promise<{ userId: string; nome: string; role: 'ADMIN' | 'DONO' }> {
  const token = (await cookies()).get('sessao_admin')?.value;
  const sessao = token ? await validarSessao(token) : null;
  if (!sessao) redirect('/admin/login');
  // A Portaria usa a mesma conta/login, mas nunca entra no Administrativo.
  if (sessao.role === 'PORTARIA') redirect('/portaria');
  // `role` (não o objeto) é o que o TypeScript estreitou acima: devolve com o papel já sem PORTARIA.
  return { ...sessao, role: sessao.role };
}

/** Só o DONO passa; um ADMIN comum volta para a tela inicial do Administrativo. */
export async function requireDono(): Promise<{ userId: string; nome: string; role: 'DONO' }> {
  const sessao = await requireAdmin();
  if (sessao.role !== 'DONO') redirect('/admin');
  return { ...sessao, role: 'DONO' };
}
