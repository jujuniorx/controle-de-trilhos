'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { TelaEntrada } from '@/components/ui/TelaEntrada';
import { loginPortariaAction, type EstadoLoginPortaria } from './actions';

const ESTADO_INICIAL: EstadoLoginPortaria = {};

export default function LoginPortariaPage() {
  const [estado, formAction, enviando] = useActionState(loginPortariaAction, ESTADO_INICIAL);
  return (
    <TelaEntrada area="area-admin">
      <h1 className="font-condensed text-2xl font-bold uppercase tracking-wide text-ink">Portaria</h1>
      <p className="mt-1 text-sm text-ink-muted">Entre com seu usuário e senha.</p>
      <form action={formAction} className="mt-4 space-y-4">
        <div className="field">
          <label htmlFor="identificador">Usuário</label>
          <input id="identificador" name="identificador" type="text" required className="h-12" autoCapitalize="none" autoComplete="username" />
        </div>
        <div className="field">
          <label htmlFor="senha">Senha</label>
          <input id="senha" name="senha" type="password" required className="h-12" autoComplete="current-password" />
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
      <Link href="/" className="mt-6 text-center text-sm text-ink-muted underline hover:text-ink">
        ← Voltar ao início (trocar de setor)
      </Link>
    </TelaEntrada>
  );
}
