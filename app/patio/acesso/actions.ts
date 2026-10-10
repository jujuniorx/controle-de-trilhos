'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verificarPinComBloqueio, criarAcessoPatio } from '@/lib/services/patioAcesso';

export async function acessarPatio(formData: FormData): Promise<{ ok: boolean; erro?: string }> {
  const pin = String(formData.get('pin') ?? '');
  const resultado = await verificarPinComBloqueio(pin);
  if (!resultado.ok) return { ok: false, erro: resultado.erro };

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

/**
 * Estado do formulário de acesso — `erro` é a única coisa que a página renderiza.
 * Só o tipo mora aqui (tipos são apagados na compilação): um arquivo 'use server'
 * não pode exportar nada além de funções async, então o valor inicial é declarado
 * na própria página.
 */
export interface EstadoAcessoPatio {
  erro?: string;
}

/**
 * Assinatura de `useActionState` (estado anterior + FormData → novo estado). Em
 * caso de sucesso `acessarPatio` faz `redirect()`, que lança NEXT_REDIRECT e
 * nunca chega no `return` — o estado só é usado no caminho de falha.
 *
 * Antes esta função devolvia `Promise<void>` e descartava o resultado, então
 * NENHUM erro de PIN chegava ao operador: nem "PIN inválido", nem a mensagem de
 * bloqueio após 5 tentativas. Num tablet compartilhado, isso significava a única
 * porta de entrada do Pátio parar de funcionar por 15 minutos sem nenhum aviso.
 */
export async function acessarPatioAction(
  _estadoAnterior: EstadoAcessoPatio,
  formData: FormData,
): Promise<EstadoAcessoPatio> {
  const resultado = await acessarPatio(formData);
  return { erro: resultado.erro ?? 'Não foi possível entrar. Tente novamente.' };
}
