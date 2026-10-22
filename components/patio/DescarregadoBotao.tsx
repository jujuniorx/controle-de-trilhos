'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { marcarDescarregadoAction } from '@/app/patio/(protegido)/recebimentos/actions';

/** Pátio: descarregou, libera a saída e mede depois. */
export function DescarregadoBotao({ id }: { id: string }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState('');
  return (
    <div className="space-y-1">
      <button
        type="button"
        className="btn btn-ghost h-12 w-full"
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            setErro('');
            try {
              const r = await marcarDescarregadoAction(id);
              if (!r.ok) setErro(r.erro ?? 'Não foi possível concluir.');
              else router.refresh();
            } catch {
              setErro('Sem conexão. Tente de novo quando houver internet.');
            }
          })
        }
      >
        {pendente ? 'Aguarde...' : 'Descarregado — liberar saída e medir depois'}
      </button>
      {erro && <p role="alert" className="text-sm text-bad">{erro}</p>}
    </div>
  );
}
