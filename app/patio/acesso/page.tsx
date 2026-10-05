'use client';

import { useActionState } from 'react';
import { acessarPatioAction, type EstadoAcessoPatio } from './actions';

const ESTADO_INICIAL: EstadoAcessoPatio = {};

export default function AcessoPatioPage() {
  const [estado, formAction, enviando] = useActionState(acessarPatioAction, ESTADO_INICIAL);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <h1 className="text-xl font-semibold text-neutral-900">Acesso do Pátio</h1>
      <p className="mt-1 text-sm text-neutral-600">Digite o código de acesso do Pátio para continuar.</p>

      <form action={formAction} className="mt-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700" htmlFor="pin">
            Código de acesso
          </label>
          <input
            id="pin"
            name="pin"
            type="password"
            inputMode="numeric"
            required
            className="mt-1 h-12 w-full rounded border px-3 text-center text-lg tracking-widest"
          />
        </div>

        <button
          type="submit"
          disabled={enviando}
          className="h-12 w-full rounded bg-neutral-900 font-medium text-white disabled:bg-neutral-300"
        >
          {enviando ? 'Entrando...' : 'Entrar'}
        </button>

        {/* Sem isto o operador não vê nem "Código inválido." nem a mensagem de
            bloqueio após 5 tentativas — num tablet compartilhado, o Pátio ficaria
            inacessível por 15 minutos e o único sintoma seria "o botão não faz nada". */}
        {estado.erro && (
          <p role="alert" className="text-sm text-red-700">
            {estado.erro}
          </p>
        )}
      </form>
    </main>
  );
}
