'use client';

import { useActionState } from 'react';
import { CampoSenha } from '@/components/ui/CampoSenha';
import Link from 'next/link';
import { trocarSenhaAction, type EstadoTrocarSenha } from './actions';

const ESTADO_INICIAL: EstadoTrocarSenha = {};

export default function TrocarSenhaPage() {
  const [estado, formAction, enviando] = useActionState(trocarSenhaAction, ESTADO_INICIAL);

  return (
    <main className="mx-auto w-full max-w-sm">
      <Link href="/admin" className="back-link">
        ← Voltar
      </Link>
      <h1 className="mt-2 font-condensed text-xl font-bold uppercase tracking-wide text-ink">Trocar minha senha</h1>

      {estado.sucesso ? (
        <p className="badge badge-ok mt-4 !text-sm !normal-case">
          Senha alterada com sucesso. Use a senha nova no próximo login.
        </p>
      ) : (
        <form action={formAction} className="mt-4 space-y-4">
          <div className="field">
            <label htmlFor="senhaAtual">Senha atual *</label>
            <CampoSenha id="senhaAtual" name="senhaAtual" required autoComplete="current-password" />
          </div>

          <div className="field">
            <label htmlFor="novaSenha">Nova senha *</label>
            <CampoSenha id="novaSenha" name="novaSenha" required autoComplete="new-password" />
            <p className="hint">Mínimo 8 caracteres, com ao menos uma letra e um número.</p>
          </div>

          <div className="field">
            <label htmlFor="confirmacao">Confirmar nova senha *</label>
            <CampoSenha id="confirmacao" name="confirmacao" required autoComplete="new-password" />
          </div>

          <button type="submit" disabled={enviando} className="btn btn-primary h-12 w-full">
            {enviando ? 'Salvando...' : 'Salvar nova senha'}
          </button>

          {estado.erro && (
            <p role="alert" className="text-sm text-bad">
              {estado.erro}
            </p>
          )}
        </form>
      )}
    </main>
  );
}
