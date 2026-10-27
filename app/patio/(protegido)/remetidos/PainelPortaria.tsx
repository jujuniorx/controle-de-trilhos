'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { desfazerLiberacaoAction, liberarCarretaAction } from './portaria-actions';
import type { EstadoPortaria } from '@/lib/domain/portaria';

/**
 * Fica no topo da tela de confirmação do remetido. Mostra em que ponto a carreta está na
 * Portaria e, quando ela já chegou, o botão "Liberar carreta" (o Pátio é quem libera).
 */
/** Nota fiscal da carreta liberada: emitida, pendente (já conferida, falta emitir) ou ainda sem aviso (não conferida). */
export type SituacaoNota = 'EMITIDA' | 'PENDENTE' | null;

export function PainelPortaria({ id, estado, nota = null }: { id: string; estado: EstadoPortaria; nota?: SituacaoNota }) {
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

  return (
    <div className="card mt-4 space-y-2">
      {estado === 'AGUARDANDO_CARRETA' && (
        <>
          <span className="badge badge-muted">Aguardando a carreta chegar na Portaria</span>
          <p className="text-sm text-ink-muted">Quando ela chegar, a Portaria registra e você é avisado aqui.</p>
        </>
      )}
      {estado === 'CHEGOU' && (
        <>
          <span className="badge badge-warn">Carreta na Portaria</span>
          <p className="text-sm text-ink-muted">Carregue, confira e confirme abaixo. Depois toque em &ldquo;Liberar carreta&rdquo; para a Portaria deixar sair.</p>
          <button type="button" className="btn btn-primary h-12" disabled={pendente} onClick={() => executar(liberarCarretaAction)}>
            {pendente ? 'Liberando...' : 'Liberar carreta'}
          </button>
        </>
      )}
      {estado === 'LIBERADA' && (
        <>
          <span className="badge badge-ok">Carreta liberada — a Portaria foi avisada</span>
          {nota === 'EMITIDA' && <span className="badge badge-ok">Nota fiscal emitida</span>}
          {nota === 'PENDENTE' && <span className="badge badge-warn">Nota fiscal pendente: falta emitir a nota desta carreta</span>}
          <button type="button" className="btn btn-ghost btn-sm" disabled={pendente} onClick={() => executar(desfazerLiberacaoAction)}>
            Liberei sem querer — desfazer
          </button>
        </>
      )}
      {estado === 'SAIU' && <span className="badge badge-ok">Carreta já saiu</span>}
      {erro && (
        <p role="alert" className="text-sm text-bad">
          {erro}
        </p>
      )}
    </div>
  );
}
