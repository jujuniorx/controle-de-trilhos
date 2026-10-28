'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { TelaEntrada } from '@/components/ui/TelaEntrada';
import { loginPortariaAction, type EstadoLoginPortaria } from './actions';

const ESTADO_INICIAL: EstadoLoginPortaria = {};

export default function LoginPortariaPage() {
  const [estado, formAction, enviando] = useActionState(loginPortariaAction, ESTADO_INICIAL);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  return (
    <TelaEntrada area="area-admin">
      <div className="portaria-tela">
        <h1 className="font-condensed text-2xl font-bold uppercase tracking-wide text-ink">Portaria</h1>
        <p className="mt-1 text-sm text-ink-muted">Entre com seu usuário e senha.</p>
        <form action={formAction} className="mt-4 space-y-4">
          <div className="field">
            <label htmlFor="identificador">Usuário</label>
            <input id="identificador" name="identificador" type="text" required autoFocus className="h-12" autoCapitalize="none" autoComplete="username" />
          </div>
          <div className="field">
            <label htmlFor="senha">Senha</label>
            <div className="flex gap-2">
              <input id="senha" name="senha" type={mostrarSenha ? 'text' : 'password'} required className="h-12 min-w-0 flex-1" autoComplete="current-password" />
              <button type="button" className="btn btn-ghost h-12 px-4" onClick={() => setMostrarSenha((m) => !m)} aria-pressed={mostrarSenha}>
                {mostrarSenha ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
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
        <Link href="/" className="btn btn-ghost mt-6 h-12 w-full">
          Voltar ao início (trocar de setor)
        </Link>
      </div>
    </TelaEntrada>
  );
}
