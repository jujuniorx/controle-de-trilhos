'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

/** Botão com confirmação em duas etapas (a tela não tem diálogo do navegador). */
export function BotaoApagar({ rotulo, aviso, acao }: { rotulo: string; aviso: string; acao: () => Promise<{ ok: boolean; erro?: string }> }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState('');
  const [pendente, iniciar] = useTransition();

  if (!confirmando) {
    return (
      <button type="button" className="btn btn-ghost btn-sm text-bad" onClick={() => setConfirmando(true)}>
        {rotulo}
      </button>
    );
  }
  return (
    <div className="flex w-full flex-wrap items-center gap-2 rounded-lg border border-bad/40 bg-bad/10 p-2 text-sm">
      <span className="flex-1 text-ink">{aviso}</span>
      <button
        type="button"
        className="btn btn-sm text-bad"
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            setErro('');
            try {
              const r = await acao();
              if (!r.ok) setErro(r.erro ?? 'Não foi possível apagar.');
              else router.refresh();
            } catch {
              setErro('Sem conexão. Tente de novo.');
            }
          })
        }
      >
        {pendente ? 'Apagando...' : 'Sim, apagar'}
      </button>
      <button type="button" className="btn btn-ghost btn-sm" disabled={pendente} onClick={() => setConfirmando(false)}>
        Não
      </button>
      {erro && (
        <p role="alert" className="w-full text-bad">
          {erro}
        </p>
      )}
    </div>
  );
}
