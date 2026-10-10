'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';
import { acessarPatioAction, type EstadoAcessoPatio } from './actions';

const ESTADO_INICIAL: EstadoAcessoPatio = {};

export default function AcessoPatioPage() {
  const [estado, formAction, enviando] = useActionState(acessarPatioAction, ESTADO_INICIAL);

  return (
    <main className="area-patio mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <Logo size={56} className="mb-6" />
      <h1 className="font-condensed text-2xl font-bold uppercase tracking-wide text-ink">Acesso do Pátio</h1>
      <p className="mt-1 text-sm text-ink-muted">Digite o código de acesso do Pátio para continuar.</p>

      <form action={formAction} className="mt-4 space-y-4">
        <div className="field">
          <label htmlFor="pin">Código de acesso</label>
          <input
            id="pin"
            name="pin"
            type="password"
            inputMode="numeric"
            required
            className="h-12 text-center text-lg tracking-widest"
          />
        </div>

        <button
          type="submit"
          disabled={enviando}
          className="btn btn-primary h-12 w-full disabled:cursor-not-allowed disabled:opacity-40"
        >
          {enviando ? 'Entrando...' : 'Entrar'}
        </button>

        {/* Sem isto o operador não vê nem "Código inválido." nem a mensagem de
            bloqueio após 5 tentativas — num tablet compartilhado, o Pátio ficaria
            inacessível por 15 minutos e o único sintoma seria "o botão não faz nada". */}
        {estado.erro && (
          <p role="alert" className="text-sm text-bad">
            {estado.erro}
          </p>
        )}
      </form>

      <Link href="/" className="mt-6 text-center text-sm text-ink-muted underline hover:text-ink">
        ← Voltar ao início (trocar entre Pátio e Administrativo)
      </Link>
    </main>
  );
}
