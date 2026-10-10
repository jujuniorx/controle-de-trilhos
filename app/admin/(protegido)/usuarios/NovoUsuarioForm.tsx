'use client';

import { useActionState } from 'react';
import { criarUsuarioAction, type EstadoUsuarios } from './actions';

export function NovoUsuarioForm() {
  const [estado, formAction, enviando] = useActionState(criarUsuarioAction, {} as EstadoUsuarios);
  return (
    <form action={formAction} className="card space-y-3 p-4">
      <h2 className="card-title">Nova conta</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="field">
          <label htmlFor="nome">Nome *</label>
          <input id="nome" name="nome" required className="h-12" autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="username">Usuário (para entrar) *</label>
          <input id="username" name="username" required className="h-12" autoCapitalize="none" autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="senha">Senha inicial *</label>
          <input id="senha" name="senha" type="text" required className="h-12" autoComplete="off" />
        </div>
      </div>
      <p className="hint">Senha com ao menos 8 caracteres, uma letra e um número. A pessoa pode trocá-la depois.</p>
      <button type="submit" disabled={enviando} className="btn btn-primary h-12">
        {enviando ? 'Criando...' : 'Criar conta'}
      </button>
      {estado.erro && (
        <p role="alert" className="text-sm text-bad">
          {estado.erro}
        </p>
      )}
      {estado.sucesso && <p className="badge badge-ok !text-sm !normal-case">{estado.sucesso}</p>}
    </form>
  );
}
