'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verificarPinProducaoComBloqueio, valorCookieProducao, COOKIE_PRODUCAO } from '@/lib/services/producaoAcesso';
import { ipDoCliente } from '@/lib/services/clienteIp';

export interface EstadoLoginProducao {
  erro?: string;
}

export async function loginProducaoAction(_anterior: EstadoLoginProducao, formData: FormData): Promise<EstadoLoginProducao> {
  const resultado = await verificarPinProducaoComBloqueio(String(formData.get('pin') ?? ''), await ipDoCliente());
  if (!resultado.ok) return { erro: resultado.erro };
  const valor = valorCookieProducao();
  if (!valor) return { erro: 'Acesso da Produção não configurado. Avise o escritório.' };
  (await cookies()).set(COOKIE_PRODUCAO, valor, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 90, path: '/' });
  redirect('/producao');
}
