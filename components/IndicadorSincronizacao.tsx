'use client';

import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import { db } from '@/lib/offline/db';
import { sincronizarPendentes } from '@/lib/offline/sync';
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';

// Intervalo do disparo periódico de sincronização. Este componente é o ÚNICO lugar do
// app responsável pelo disparo RECORRENTE (mount + evento `online` + intervalo) —
// Task 6 dispara apenas a tentativa imediata pós-submissão do wizard, sem intervalo
// nem listener; dois disparadores recorrentes competindo foi descartado no pré-flight
// scan do plano.
const INTERVALO_SINCRONIZACAO_MS = 30_000;

export function IndicadorSincronizacao() {
  const online = useOnlineStatus();
  const [pendentes, setPendentes] = useState(0);

  // Reativo: observa direto no IndexedDB local quantos registros ainda não estão
  // SINCRONIZADO. liveQuery é observação local (Dexie), não um disparo de rede em
  // loop — não conflita com a responsabilidade de disparo recorrente abaixo.
  useEffect(() => {
    const assinatura = liveQuery(() =>
      db.recebimentos.where('syncStatus').anyOf(['PENDENTE', 'SINCRONIZANDO', 'ERRO']).count(),
    ).subscribe({
      next: (contagem) => setPendentes(contagem),
      error: () => setPendentes(0),
    });
    return () => assinatura.unsubscribe();
  }, []);

  // Disparo recorrente de sincronizarPendentes(): ao montar, ao voltar a ficar online,
  // e periodicamente enquanto este indicador estiver montado (ele fica visível em toda
  // a área do Pátio via app/patio/(protegido)/layout.tsx, inclusive durante o wizard).
  useEffect(() => {
    void sincronizarPendentes();

    function aoFicarOnline() {
      void sincronizarPendentes();
    }

    window.addEventListener('online', aoFicarOnline);
    const intervalo = setInterval(() => {
      void sincronizarPendentes();
    }, INTERVALO_SINCRONIZACAO_MS);

    return () => {
      window.removeEventListener('online', aoFicarOnline);
      clearInterval(intervalo);
    };
  }, []);

  return (
    <div role="status" aria-live="polite" className="flex items-center gap-2 border-b bg-neutral-50 px-4 py-1 text-xs text-neutral-600">
      {!online && <span className="font-medium text-amber-700">Offline</span>}
      {pendentes > 0 && (
        <span>
          {pendentes} recebimento{pendentes > 1 ? 's' : ''} pendente{pendentes > 1 ? 's' : ''} de sincronização
        </span>
      )}
      {online && pendentes === 0 && <span>Sincronizado</span>}
    </div>
  );
}
