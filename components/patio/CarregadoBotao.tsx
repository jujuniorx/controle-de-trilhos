'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { marcarCarregadoAction } from '@/app/patio/(protegido)/recebimentos/actions';

/** Pátio, carga e descarga: carrega a carreta. Um toque só, sem campos. */
export function CarregadoBotao({ id }: { id: string }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState('');
  return (
    <div className="space-y-1">
      <button
        type="button"
        className="btn btn-primary h-12 w-full"
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            setErro('');
            try {
              const r = await marcarCarregadoAction(id);
              if (!r.ok) setErro(r.erro ?? 'Não foi possível concluir.');
              else router.refresh();
            } catch {
              setErro('Sem conexão. Tente de novo quando houver internet.');
            }
          })
        }
      >
        {pendente ? 'Aguarde...' : 'Carregar esta carreta'}
      </button>
      {erro && <p role="alert" className="text-sm text-bad">{erro}</p>}
    </div>
  );
}
