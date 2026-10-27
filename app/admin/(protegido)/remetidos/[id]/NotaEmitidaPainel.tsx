'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { confirmarNotaEmitidaAction } from './actions';

/** Confirmação de que a nota fiscal da carreta liberada pelo Pátio foi emitida (para os avisos de nota pendente). */
export function NotaEmitidaPainel({ movimentacaoId, emitidaEm, emitidaPor }: { movimentacaoId: string; emitidaEm: string | null; emitidaPor: string | null }) {
  const router = useRouter();
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  if (emitidaEm) {
    return (
      <div className="conf-block mt-3">
        <p className="font-semibold text-ok">Nota fiscal emitida{emitidaPor ? ` por ${emitidaPor}` : ''}.</p>
      </div>
    );
  }

  async function confirmar() {
    setErro('');
    setSalvando(true);
    const resultado = await confirmarNotaEmitidaAction(movimentacaoId);
    setSalvando(false);
    if (!resultado.ok) {
      setErro(resultado.erro ?? 'Não foi possível confirmar.');
      return;
    }
    router.refresh();
  }

  return (
    <div className="conf-block mt-3">
      <p className="mb-2 font-semibold text-warn">Nota fiscal pendente: o Pátio liberou a carreta, falta emitir a nota.</p>
      <button className="btn btn-primary h-11" disabled={salvando} onClick={confirmar}>
        {salvando ? 'Confirmando...' : 'Confirmar nota emitida'}
      </button>
      {erro && <p className="mt-1 text-sm text-bad">{erro}</p>}
    </div>
  );
}
