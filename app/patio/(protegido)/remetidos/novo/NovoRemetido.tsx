'use client';

import { useState } from 'react';
import { RemetidoWizard } from '../RemetidoWizard';
import { PreCadastroForm } from './PreCadastroForm';

type Modo = 'aguardando' | 'agora';

/** Novo remetido: ou só deixa "aguardando chegada", ou lança agora (caminhão já carregado). */
export function NovoRemetido() {
  const [modo, setModo] = useState<Modo>('aguardando');

  return (
    <>
      <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label="Como cadastrar o remetido">
        <button
          type="button"
          aria-pressed={modo === 'aguardando'}
          onClick={() => setModo('aguardando')}
          className={`btn h-12 ${modo === 'aguardando' ? 'btn-primary' : 'btn-ghost'}`}
        >
          Aguardando chegada
        </button>
        <button
          type="button"
          aria-pressed={modo === 'agora'}
          onClick={() => setModo('agora')}
          className={`btn h-12 ${modo === 'agora' ? 'btn-primary' : 'btn-ghost'}`}
        >
          Lançar agora
        </button>
      </div>

      {modo === 'aguardando' ? (
        <PreCadastroForm />
      ) : (
        <>
          <p className="mt-4 text-sm text-ink-muted">Caminhão já carregado: lance os materiais e as medições agora.</p>
          <RemetidoWizard modo="novo" />
        </>
      )}
    </>
  );
}
