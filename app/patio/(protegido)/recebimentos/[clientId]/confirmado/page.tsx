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
      <main className="mx-auto max-w-xl p-6">
        <p className="text-sm text-neutral-600">Carregando...</p>
      </main>
    );
  }

  if (!registro) {
    // Equivalente client-side de notFound(): nenhum registro local com este clientId
    // (ex.: link acessado direto, em outro dispositivo, ou dados locais limpos).
    return (
      <main className="mx-auto max-w-xl p-6">
        <h1 className="text-lg font-semibold">Recebimento não encontrado</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Não há nenhum recebimento salvo neste dispositivo com este identificador.
        </p>
        <Link href="/patio" className="mt-6 inline-block h-11 rounded border px-4 py-2">
          Voltar ao início
        </Link>
      </main>
    );
  }

  const { payload, syncStatus, erro } = registro;
  const temSucata = payload.grupos.some((g) => g.tipoMaterial === 'SUCATA');

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-lg font-semibold">Recebimento salvo</h1>
      <p className="mt-2 text-sm text-neutral-600">NF {payload.dados.numeroDocumento}</p>

      <div className="mt-3 rounded border p-3 text-sm">
        <p>{mensagemStatus(syncStatus, erro)}</p>
        {syncStatus === 'ERRO' && (
          <button
            className="mt-2 h-10 rounded border px-3 disabled:opacity-50"
            onClick={tentarNovamente}
            disabled={retentando}
          >
            {retentando ? 'Tentando novamente...' : 'Tentar novamente'}
          </button>
        )}
      </div>

      <ul className="mt-4 space-y-2 text-sm">
        {payload.grupos.map((g, i) => (
          <li key={g.clientId} className="rounded border p-2">
            Grupo {i + 1}: {g.perfil} — {g.tipoMaterial} — {g.medicoes.length} medição(ões) —{' '}
            {metrosDoGrupo(g.medicoes).toFixed(2)} m —{' '}
            {g.tipoMaterial === 'SUCATA' ? 'peso pendente' : 'peso calculado ao sincronizar'}
          </li>
        ))}
      </ul>
      {temSucata && (
        <p className="mt-3 text-sm text-amber-700">
          Este recebimento tem sucata com peso pendente. O peso será informado pelo Administrativo com base no
          documento de pesagem.
        </p>
      )}
      <Link href="/patio" className="mt-6 inline-block h-11 rounded border px-4 py-2">
        Voltar ao início
      </Link>
    </main>
  );
}
