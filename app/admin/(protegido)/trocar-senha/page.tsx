'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { trocarSenhaAction, type EstadoTrocarSenha } from './actions';

const ESTADO_INICIAL: EstadoTrocarSenha = {};

export default function TrocarSenhaPage() {
  const [estado, formAction, enviando] = useActionState(trocarSenhaAction, ESTADO_INICIAL);

  return (
    <main className="mx-auto max-w-sm p-6">
      <Link href="/admin" className="text-sm text-neutral-500 hover:underline">
        ← Voltar
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-neutral-900">Trocar minha senha</h1>

      {estado.sucesso ? (
        <p className="mt-4 rounded bg-emerald-50 p-3 text-sm text-emerald-800">
          Senha alterada com sucesso. Use a senha nova no próximo login.
        </p>
      ) : (
        <form action={formAction} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700" htmlFor="senhaAtual">
              Senha atual *
            </label>
            <input
              id="senhaAtual"
              name="senhaAtual"
              type="password"
              required
              className="mt-1 h-12 w-full rounded border px-3"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700" htmlFor="novaSenha">
              Nova senha *
            </label>
            <input
              id="novaSenha"
              name="novaSenha"
              type="password"
              required
              className="mt-1 h-12 w-full rounded border px-3"
            />
            <p className="mt-1 text-xs text-neutral-500">Mínimo 8 caracteres, com ao menos uma letra e um número.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700" htmlFor="confirmacao">
              Confirmar nova senha *
            </label>
            <input
              id="confirmacao"
              name="confirmacao"
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
            {enviando ? 'Salvando...' : 'Salvar nova senha'}
          </button>

          {estado.erro && (
            <p role="alert" className="text-sm text-red-700">
              {estado.erro}
            </p>
          )}
        </form>
      )}
    </main>
  );
}
