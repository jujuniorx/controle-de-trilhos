'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';
import { codigoAction, type EstadoCodigo } from './actions';

const ESTADO_INICIAL: EstadoCodigo = {};

export default function CodigoPage() {
  const [estado, formAction, enviando] = useActionState(codigoAction, ESTADO_INICIAL);

  return (
    <main className="area-admin mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <Logo size={56} className="mb-6" />
      <h1 className="font-condensed text-2xl font-bold uppercase tracking-wide text-ink">Verificação em duas etapas</h1>
      <p className="mt-1 text-sm text-ink-muted">Digite o código de 6 dígitos do seu app autenticador.</p>

      <form action={formAction} className="mt-4 space-y-4">
        <div className="field">
          <label htmlFor="codigo">Código</label>
          <input
            id="codigo"
            name="codigo"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]*"
            maxLength={7}
            required
            autoFocus
            className="h-12 text-center text-xl tracking-widest"
          />
        </div>
        <button type="submit" disabled={enviando} className="btn btn-primary h-12 w-full">
          {enviando ? 'Verificando...' : 'Entrar'}
        </button>
        {estado.erro && (
          <p role="alert" className="text-sm text-bad">
            {estado.erro}
          </p>
        )}
      </form>

      <Link href="/admin/login" className="mt-6 text-center text-sm text-ink-muted underline hover:text-ink">
        ← Voltar ao login
      </Link>
    </main>
  );
}
