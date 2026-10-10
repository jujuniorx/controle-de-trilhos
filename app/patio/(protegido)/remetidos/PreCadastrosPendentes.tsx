'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { liveQuery } from 'dexie';
import { db, type PreCadastroLocal } from '@/lib/offline/db';

const TIPO_REMETIDO_LABEL: Record<string, string> = {
  VENDA: 'Venda',
  TRANS: 'Transferência',
  INDUS: 'Industrialização',
};

/**
 * Pré-cadastros feitos neste aparelho que o servidor ainda não confirmou (sem internet,
 * ou enviando). Aparecem aqui para o operador ver que o cadastro não se perdeu; quando
 * sincronizam, saem desta lista e a página recarrega os dados do servidor, onde já
 * aparecem como "aguardando chegada" e podem ser tocados para confirmar o carregamento.
 */
export function PreCadastrosPendentes() {
  const router = useRouter();
  const [itens, setItens] = useState<PreCadastroLocal[]>([]);
  const quantidadeAnterior = useRef(0);

  useEffect(() => {
    const assinatura = liveQuery(() =>
      db.preCadastros.where('syncStatus').anyOf(['PENDENTE', 'SINCRONIZANDO', 'ERRO']).toArray(),
    ).subscribe({
      next: (lista) => {
        // Algum saiu da fila = foi sincronizado: recarrega a lista vinda do servidor.
        if (lista.length < quantidadeAnterior.current) router.refresh();
        quantidadeAnterior.current = lista.length;
        setItens(lista);
      },
      error: () => setItens([]),
    });
    return () => assinatura.unsubscribe();
  }, [router]);

  if (itens.length === 0) return null;

  return (
    <div className="space-y-2" aria-label="Cadastros aguardando sincronização">
      {itens.map((item) => (
        <div key={item.clientId} className="card">
          <p className="font-medium text-ink">{item.payload.destino}</p>
          <p className="text-sm text-ink-muted">
            {TIPO_REMETIDO_LABEL[item.payload.tipoRemetido] ?? '—'}
            {item.payload.reservaPedido ? ` · Reserva ${item.payload.reservaPedido}` : ''}
          </p>
          {item.syncStatus === 'ERRO' ? (
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="text-sm text-bad">{item.erro ?? 'Não foi possível enviar este cadastro.'}</p>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => void db.preCadastros.delete(item.clientId)}
              >
                Descartar
              </button>
            </div>
          ) : (
            <span className="badge badge-warn mt-1">Aguardando sincronização</span>
          )}
        </div>
      ))}
    </div>
  );
}
