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
  const [sessaoExpirada, setSessaoExpirada] = useState(false);

  // Reativo: observa direto no IndexedDB local quantos registros ainda não estão
  // SINCRONIZADO. liveQuery é observação local (Dexie), não um disparo de rede em
  // loop — não conflita com a responsabilidade de disparo recorrente abaixo.
  useEffect(() => {
    const assinatura = liveQuery(async () => {
      const naoSincronizados = ['PENDENTE', 'SINCRONIZANDO', 'ERRO'];
      const recebimentos = await db.recebimentos.where('syncStatus').anyOf(naoSincronizados).count();
      const preCadastros = await db.preCadastros.where('syncStatus').anyOf(naoSincronizados).count();
      return recebimentos + preCadastros;
    }).subscribe({
      next: (contagem) => setPendentes(contagem),
      error: () => setPendentes(0),
    });
    return () => assinatura.unsubscribe();
  }, []);

  // Registros que falharam por "Não autorizado" são da sessão que expirou (ex.: o aparelho ficou
  // dias sem internet): não são dados ruins. Ao abrir o Pátio com a sessão válida, voltam para a fila;
  // se a sessão ainda estiver expirada, o aviso abaixo pede para entrar de novo.
  useEffect(() => {
    const assinatura = liveQuery(async () => {
      const a = await db.recebimentos.where('syncStatus').equals('ERRO').filter((r) => r.erro === 'Não autorizado').count();
      const b = await db.preCadastros.where('syncStatus').equals('ERRO').filter((r) => r.erro === 'Não autorizado').count();
      return a + b > 0;
    }).subscribe({ next: setSessaoExpirada, error: () => setSessaoExpirada(false) });
    return () => assinatura.unsubscribe();
  }, []);

  useEffect(() => {
    if (!online) return;
    void (async () => {
      try {
        await db.recebimentos.where('syncStatus').equals('ERRO').filter((r) => r.erro === 'Não autorizado').modify({ syncStatus: 'PENDENTE', erro: undefined });
        await db.preCadastros.where('syncStatus').equals('ERRO').filter((r) => r.erro === 'Não autorizado').modify({ syncStatus: 'PENDENTE', erro: undefined });
      } catch {
        // best-effort
      }
    })();
  }, [online]);

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
    <div role="status" aria-live="polite" className="border-b border-line bg-surface text-xs text-ink-muted">
      {!online && (
        <div className="aviso-offline">
          <strong>Sem internet.</strong> Pode continuar lançando: tudo fica salvo neste aparelho e é enviado
          automaticamente quando o sinal voltar.
        </div>
      )}
      {sessaoExpirada && online && (
        <div className="aviso-offline">
          <strong>Sessão do Pátio expirada.</strong> Seus lançamentos estão guardados.{' '}
          <a href="/patio/acesso" className="underline">
            Entre de novo
          </a>{' '}
          para enviá-los.
        </div>
      )}
      <div className="flex items-center gap-2 px-4 py-1.5">
        {!online && <span className="badge badge-warn">Offline</span>}
        {pendentes > 0 && (
          <span className="badge badge-warn">
            {pendentes} registro{pendentes > 1 ? 's' : ''} pendente{pendentes > 1 ? 's' : ''} de sincronização
          </span>
        )}
        {online && pendentes === 0 && <span className="badge badge-ok">Sincronizado</span>}
      </div>
    </div>
  );
}
