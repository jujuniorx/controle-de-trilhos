'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { TelaEntrada } from '@/components/ui/TelaEntrada';
import { CampoSenha } from '@/components/ui/CampoSenha';
import { loginProducaoAction, type EstadoLoginProducao } from './actions';

const ESTADO_INICIAL: EstadoLoginProducao = {};

export default function LoginProducaoPage() {
  const [estado, formAction, enviando] = useActionState(loginProducaoAction, ESTADO_INICIAL);
  return (
    <TelaEntrada area="area-admin">
      <h1 className="font-condensed text-2xl font-bold uppercase tracking-wide text-ink">Produção</h1>
      <p className="mt-1 text-sm text-ink-muted">Digite o código de acesso da equipe de soldagem.</p>
      <form action={formAction} className="mt-4 space-y-4">
        <div className="field">
          <label htmlFor="pin">Código de acesso</label>
          <CampoSenha id="pin" name="pin" inputMode="numeric" autoComplete="one-time-code" maxLength={12} required autoFocus className="h-14 text-center tracking-[.4em]" style={{ fontSize: '18px' }} />
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
    </TelaEntrada>
  );
}
