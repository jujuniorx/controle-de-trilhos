'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { liveQuery } from 'dexie';
import { db, type RecebimentoLocal, type SyncStatus } from '@/lib/offline/db';
import { sincronizarPendentes } from '@/lib/offline/sync';

function metrosDaMedicao(m: { quantidade: number; comprimento: number }): number {
  return Math.round(m.quantidade * m.comprimento * 100) / 100;
}

function metrosDoGrupo(medicoes: { quantidade: number; comprimento: number }[]): number {
  return Math.round(medicoes.reduce((acc, m) => acc + metrosDaMedicao(m), 0) * 100) / 100;
}

function mensagemStatus(status: SyncStatus, erro?: string): string {
  switch (status) {
    case 'PENDENTE':
      return 'Salvo neste dispositivo — aguardando conexão para sincronizar com o servidor.';
    case 'SINCRONIZANDO':
      return 'Salvo neste dispositivo, sincronizando...';
    case 'SINCRONIZADO':
      return 'Sincronizado com sucesso.';
    case 'ERRO':
      return `Falha ao sincronizar: ${erro ?? 'erro desconhecido'}.`;
  }
}

export default function RecebimentoConfirmadoPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const [registro, setRegistro] = useState<RecebimentoLocal | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [retentando, setRetentando] = useState(false);

  // Reativo: liveQuery observa o registro no IndexedDB local e reemite sempre que
  // sincronizarPendentes (disparado pelo wizard, ou pelo botão "Tentar novamente"
  // abaixo) atualizar o syncStatus — sem round-trip ao servidor e sem precisar de
  // polling/setInterval (essa responsabilidade recorrente é da Task 7).
  useEffect(() => {
    const assinatura = liveQuery(() => db.recebimentos.get(clientId)).subscribe({
      next: (r) => {
        setRegistro(r ?? null);
        setCarregando(false);
      },
      error: () => {
        setRegistro(null);
        setCarregando(false);
      },
    });
    return () => assinatura.unsubscribe();
  }, [clientId]);

  async function tentarNovamente() {
    setRetentando(true);
    await db.recebimentos.update(clientId, { syncStatus: 'PENDENTE', erro: undefined });
    await sincronizarPendentes();
    setRetentando(false);
  }

  if (carregando) {
    return (
      <main className="mx-auto max-w-xl lg:max-w-3xl p-6">
        <p className="text-sm text-ink-muted">Carregando...</p>
      </main>
    );
  }

  if (!registro) {
    // Equivalente client-side de notFound(): nenhum registro local com este clientId
    // (ex.: link acessado direto, em outro dispositivo, ou dados locais limpos).
    return (
      <main className="mx-auto max-w-xl lg:max-w-3xl p-6">
        <h1 className="font-condensed text-lg font-bold uppercase tracking-wide text-ink">Recebimento não encontrado</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Não há nenhum recebimento salvo neste dispositivo com este identificador.
        </p>
        <Link href="/patio" className="btn btn-secondary mt-6 inline-flex h-11">
          Voltar ao início
        </Link>
      </main>
    );
  }

  const { payload, syncStatus, erro } = registro;
  const temSucata = payload.grupos.some((g) => g.tipoMaterial === 'SUCATA');

  const STATUS_TONE: Record<SyncStatus, string> = {
    PENDENTE: 'badge-muted',
    SINCRONIZANDO: 'badge-info',
    SINCRONIZADO: 'badge-ok',
    ERRO: 'badge-err',
  };

  return (
    <main className="mx-auto max-w-xl lg:max-w-3xl space-y-4 p-6">
      <div className="conf-block conf-ok text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full text-2xl text-white" style={{ background: 'var(--ok)' }}>✓</div>
        <h1 className="mt-2 font-condensed text-lg font-bold uppercase tracking-wide" style={{ color: 'var(--ok)' }}>Recebimento salvo</h1>
        <p className="mt-1 text-sm text-ink-muted">NF {payload.dados.numeroDocumento}</p>
      </div>

      <div className="card">
        <span className={`badge ${STATUS_TONE[syncStatus]}`}>{mensagemStatus(syncStatus, erro)}</span>
        {syncStatus === 'ERRO' && (
          <button className="btn btn-secondary btn-sm mt-3 block" onClick={tentarNovamente} disabled={retentando}>
            {retentando ? 'Tentando novamente...' : 'Tentar novamente'}
          </button>
        )}
      </div>

      <div className="card">
        <h2 className="card-title">Materiais lançados</h2>
        <div className="space-y-2">
          {payload.grupos.map((g, i) => (
            <div key={g.clientId} className="grupo-card !mb-0 p-2">
              <span className="grupo-title">
                Grupo {i + 1}: {g.perfil} — {g.tipoMaterial}
              </span>
              <p className="text-ink-muted">
                {g.medicoes.length} medição(ões) — {metrosDoGrupo(g.medicoes).toFixed(2)} m —{' '}
                {g.tipoMaterial === 'SUCATA' ? (
                  <span className="font-medium text-warn">peso pendente</span>
                ) : (
                  'peso calculado ao sincronizar'
                )}
              </p>
            </div>
          ))}
        </div>
      </div>

      {temSucata && (
        <div className="conf-block">
          <p className="text-sm font-medium text-warn">⚠ Sucata com peso pendente</p>
          <p className="mt-1 text-sm text-warn">
            Este recebimento tem sucata com peso pendente. O peso será informado pelo Administrativo com base no
            documento de pesagem.
          </p>
        </div>
      )}

      <Link href="/patio" className="btn btn-primary btn-lg h-12">
        Voltar ao início
      </Link>
    </main>
  );
}
