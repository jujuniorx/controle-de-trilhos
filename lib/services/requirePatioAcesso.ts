import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { validarAcessoPatio } from '@/lib/services/patioAcesso';

export async function requirePatioAcesso(): Promise<void> {
  const token = (await cookies()).get('acesso_patio')?.value;
  const valido = token ? await validarAcessoPatio(token) : false;
  if (!valido) redirect('/patio/acesso');
}
