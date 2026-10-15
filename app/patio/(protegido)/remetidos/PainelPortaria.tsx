'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { concluirMedicaoAction, reabrirMedicaoAction } from './portaria-actions';
import type { EstadoPortaria } from '@/lib/domain/portaria';

/**
 * Fica no topo da tela de confirmação. O Pátio avisa a Portaria que terminou de medir
 * (só falta a carreta chegar) e vê aqui quando a Portaria libera a carreta.
 */
export function PainelPortaria({ id, estado, liberadaPor }: { id: string; estado: EstadoPortaria; liberadaPor: string | null }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState('');

  function executar(acao: (id: string) => Promise<{ ok: boolean; erro?: string }>) {
    setErro('');
    iniciar(async () => {
      try {
        const r = await acao(id);
        if (!r.ok) setErro(r.erro ?? 'Não foi possível concluir.');
        else router.refresh();
      } catch {
        setErro('Sem conexão. Tente de novo quando houver internet.');
      }
    });
  }

  if (estado === 'LIBERADA') {
    return (
      <div role="status" className="card mt-4 border-2 border-ok p-4">
        <p className="font-condensed text-lg font-bold uppercase tracking-wide text-ok">Carreta liberada!</p>
        <p className="text-sm text-ink-muted">
          A Portaria liberou{liberadaPor ? ` (${liberadaPor})` : ''}. Pode carregar/descarregar e confirmar abaixo.
        </p>
      </div>
    );
  }

  return (
    <div className="card mt-4 space-y-2">
      {estado === 'MEDINDO' ? (
        <>
          <p className="text-sm font-semibold text-ink">Terminou de medir?</p>
          <p className="text-sm text-ink-muted">
            Avise a Portaria que está tudo medido e só falta a carreta chegar. Ela só pode liberar a carreta depois disso.
          </p>
          <button type="button" className="btn btn-primary h-12" disabled={pendente} onClick={() => executar(concluirMedicaoAction)}>
            {pendente ? 'Avisando...' : 'Medição concluída — avisar a Portaria'}
          </button>
        </>
      ) : (
        <>
          <span className="badge badge-ok">Medição concluída — aguardando a carreta</span>
          <p className="text-sm text-ink-muted">A Portaria já pode receber o caminhão. Você será avisado quando a carreta for liberada.</p>
          <button type="button" className="btn btn-ghost btn-sm" disabled={pendente} onClick={() => executar(reabrirMedicaoAction)}>
            Voltar a medir
          </button>
        </>
      )}
      {erro && (
        <p role="alert" className="text-sm text-bad">
          {erro}
        </p>
      )}
    </div>
  );
}
