'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { autenticar } from '@/lib/services/loginService';
import { criarPasse2fa } from '@/lib/services/segredo2fa';

export async function login(formData: FormData): Promise<{ ok: boolean; erro?: string }> {
  const identificador = String(formData.get('identificador') ?? '');
  const senha = String(formData.get('senha') ?? '');

  const resultado = await autenticar(identificador, senha);
  if (resultado.precisa2fa && resultado.userId) {
    (await cookies()).set('login_2fa', criarPasse2fa(resultado.userId), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 5 * 60,
      path: '/admin/login',
    });
    redirect('/admin/login/2fa');
  }
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

/**
 * Estado do formulário de login — `erro` é a única coisa que a página renderiza.
 * Só o tipo mora aqui (tipos são apagados na compilação): um arquivo 'use server'
 * não pode exportar nada além de funções async, então o valor inicial é declarado
 * na própria página.
 */
export interface EstadoLogin {
  erro?: string;
}

/**
 * Assinatura de `useActionState` (estado anterior + FormData → novo estado). Em
 * caso de sucesso `login` faz `redirect()`, que lança NEXT_REDIRECT e nunca chega
 * no `return` — o estado só é usado no caminho de falha.
 *
 * Antes esta função (`loginAction`) devolvia `Promise<void>` e descartava o
 * resultado, então nenhum erro chegava ao administrativo: nem "E-mail ou senha
 * inválidos", nem a mensagem de bloqueio após 5 tentativas. O botão simplesmente
 * não fazia nada — mesma classe de bug já corrigida em patio/acesso/actions.ts.
 */
export async function loginAction(_estadoAnterior: EstadoLogin, formData: FormData): Promise<EstadoLogin> {
  const resultado = await login(formData);
  return { erro: resultado.erro ?? 'Não foi possível entrar. Tente novamente.' };
}
