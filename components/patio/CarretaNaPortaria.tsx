'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { liberarCarretaAction } from '@/app/patio/(protegido)/remetidos/portaria-actions';
import { ExcluirPatioBotao } from '@/components/patio/ExcluirPatioBotao';
import { excluirRemetidoPatioAction } from '@/app/patio/(protegido)/recebimentos/actions';

export interface CarretaNaPortariaProps {
  id: string;
  ordemDia?: number | null;
  placaCarreta: string | null;
  placaCavalo: string | null;
  origem: string | null;
  destino: string | null;
  detalhe: string;
  observacao: string | null;
  chegouAs: string;
  /** Ainda falta o Pátio confirmar o carregamento (o remetido segue "aguardando chegada"). */
  faltaConfirmar: boolean;
}

/** Carreta que a Portaria registrou: o Pátio confirma o carregamento e libera para sair. */
export function CarretaNaPortaria({ id, ordemDia, placaCarreta, placaCavalo, origem, destino, detalhe, observacao, chegouAs, faltaConfirmar }: CarretaNaPortariaProps) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState('');

  return (
    <div className="card space-y-2 border-2 border-warn">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          {ordemDia != null && <p className="text-xs font-semibold uppercase tracking-wide text-warn">Carreta nº {ordemDia}</p>}
          <p className="font-condensed text-xl font-bold uppercase tracking-wide text-ink">
            {placaCarreta || 'Sem placa da carreta'}
            {placaCavalo && <span className="text-ink-muted"> · cavalo {placaCavalo}</span>}
          </p>
          <p className="text-sm text-ink">
            <span className="text-ink-muted">Destino:</span> <strong>{destino || 'não informado'}</strong>
          </p>
          <p className="text-sm text-ink">
            <span className="text-ink-muted">Origem:</span> <strong>{origem || 'não informada'}</strong>
          </p>
          {detalhe && <p className="text-sm text-ink-muted">{detalhe}</p>}
        </div>
        <span className="badge badge-warn shrink-0">Chegou às {chegouAs}</span>
      </div>
      {observacao && <p className="text-sm text-warn">Portaria: {observacao}</p>}
      <div className="flex flex-wrap gap-2">
        {faltaConfirmar && (
          <Link href={`/patio/remetidos/${id}/confirmar`} className="btn btn-ghost h-12 flex-1 sm:flex-none">
            Medir e confirmar
          </Link>
        )}
        <button
          type="button"
          className="btn btn-primary h-12 flex-1 sm:flex-none"
          disabled={pendente}
          onClick={() =>
            iniciar(async () => {
              setErro('');
              try {
                const r = await liberarCarretaAction(id);
                if (!r.ok) setErro(r.erro ?? 'Não foi possível liberar.');
                else router.refresh();
              } catch {
                setErro('Sem conexão. Tente de novo quando houver internet.');
              }
            })
          }
        >
          {pendente ? 'Liberando...' : 'Liberar carreta'}
        </button>
      </div>
      {faltaConfirmar && <p className="text-xs text-ink-muted">Libere depois de medir e confirmar.</p>}
      {erro && (
        <p role="alert" className="text-sm text-bad">
          {erro}
        </p>
      )}
      <div className="flex justify-end">
        <ExcluirPatioBotao nome={titulo} oQue="esta carreta" alvoId={id} aoConfirmar={excluirRemetidoPatioAction} />
      </div>
    </div>
  );
}
