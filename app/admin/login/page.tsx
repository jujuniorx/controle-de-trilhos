'use client';

import { useActionState } from 'react';
import { Logo } from '@/components/ui/Logo';
import { loginAction, type EstadoLogin } from './actions';

const ESTADO_INICIAL: EstadoLogin = {};

export default function LoginPage() {
  const [estado, formAction, enviando] = useActionState(loginAction, ESTADO_INICIAL);

  return (
    <main className="area-admin mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <Logo size={56} className="mb-6" />
      <h1 className="font-condensed text-2xl font-bold uppercase tracking-wide text-ink">Login do Administrativo</h1>
      <p className="mt-1 text-sm text-ink-muted">Entre com seu usuário (ou e-mail) e senha para continuar.</p>

      <form action={formAction} className="mt-4 space-y-4">
        <div className="field">
          <label htmlFor="identificador">Usuário ou e-mail</label>
          <input id="identificador" name="identificador" type="text" required className="h-12" />
        </div>

        <div className="field">
          <label htmlFor="senha">Senha</label>
          <input id="senha" name="senha" type="password" required className="h-12" />
        </div>

        <button type="submit" disabled={enviando} className="btn btn-primary h-12 w-full">
          {enviando ? 'Entrando...' : 'Entrar'}
        </button>

        {estado.erro && (
          <p role="alert" className="text-sm text-bad">
            {estado.erro}
          </p>
        )}
      </form>
    </main>
  );
}
