'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { novaChegadaAction } from './actions';
import { ICONE_MAIS } from '@/components/portaria/icones';

/** Mesmo estilo e mesma posição de "Carreta sem aviso do Pátio" na tela de Carga. */
export function BotaoNovaChegada() {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState('');
  return (
    <div className="flex flex-col items-stretch gap-1">
      <button
        type="button"
        className="btn btn-ghost h-12 w-full"
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
        {ICONE_MAIS(18)}
        {pendente ? 'Cadastrando...' : 'Nova chegada'}
      </button>
      {erro && (
        <p role="alert" className="text-sm text-bad">
          {erro}
        </p>
      )}
    </div>
  );
}
