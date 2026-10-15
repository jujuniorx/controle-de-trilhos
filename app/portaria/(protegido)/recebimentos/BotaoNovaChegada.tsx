'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { novaChegadaAction } from './actions';

export function BotaoNovaChegada() {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState('');
  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        className="btn btn-primary h-12"
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            setErro('');
            try {
              const r = await novaChegadaAction();
              if (!r.ok) setErro(r.erro ?? 'Não foi possível cadastrar.');
              else router.refresh();
            } catch {
              setErro('Sem conexão. Tente de novo.');
            }
          })
        }
      >
        {pendente ? 'Cadastrando...' : '+ Nova chegada'}
      </button>
      {erro && (
        <p role="alert" className="mt-1 text-sm text-bad">
          {erro}
        </p>
      )}
    </div>
  );
}
