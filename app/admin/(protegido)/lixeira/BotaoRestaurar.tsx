'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { restaurarMovimentacaoAction } from './actions';

export function BotaoRestaurar({ lixeiraId }: { lixeiraId: string }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function restaurar() {
    setErro(null);
    iniciar(async () => {
      const r = await restaurarMovimentacaoAction(lixeiraId);
      if (r.ok && r.irPara) router.push(r.irPara);
      else if (r.ok) router.refresh();
      else setErro(r.erro ?? 'Não foi possível restaurar.');
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" className="btn btn-primary btn-sm" onClick={restaurar} disabled={pendente}>
        {pendente ? 'Restaurando…' : 'Restaurar'}
      </button>
      {erro && (
        <p role="alert" className="max-w-xs text-right text-xs text-bad">
          {erro}
        </p>
      )}
    </div>
  );
}
