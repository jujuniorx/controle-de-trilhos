'use client';

import { useActionState } from 'react';
import { loginAction, type EstadoLogin } from './actions';

const ESTADO_INICIAL: EstadoLogin = {};

export default function LoginPage() {
  const [estado, formAction, enviando] = useActionState(loginAction, ESTADO_INICIAL);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <h1 className="text-xl font-semibold text-neutral-900">Login do Administrativo</h1>
      <p className="mt-1 text-sm text-neutral-600">Entre com seu e-mail e senha para continuar.</p>

      <form action={formAction} className="mt-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700" htmlFor="email">
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="mt-1 h-12 w-full rounded border px-3"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700" htmlFor="senha">
            Senha
          </label>
          <input
            id="senha"
            name="senha"
            type="password"
            required
            className="mt-1 h-12 w-full rounded border px-3"
          />
        </div>

        <button
          type="submit"
          disabled={enviando}
          className="h-12 w-full rounded bg-steel font-medium text-white disabled:bg-neutral-300"
        >
          {enviando ? 'Entrando...' : 'Entrar'}
        </button>

        {estado.erro && (
          <p role="alert" className="text-sm text-red-700">
            {estado.erro}
          </p>
        )}
      </form>
    </main>
  );
}
