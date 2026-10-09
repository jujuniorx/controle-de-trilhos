'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { informarNumeroDocumentoAction } from './actions';

export function NfPainel({ movimentacaoId }: { movimentacaoId: string }) {
  const router = useRouter();
  const [numero, setNumero] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setErro('');
    setSalvando(true);
    const resultado = await informarNumeroDocumentoAction(movimentacaoId, numero);
    setSalvando(false);
    if (!resultado.ok) {
      setErro(resultado.erro ?? 'Não foi possível salvar.');
      return;
    }
    router.refresh();
  }

  return (
    <div className="conf-block mt-3">
      <p className="mb-2 font-semibold text-warn">
        NF em aberto — o Pátio confirmou sem saber o número. Complete para liberar a conferência.
      </p>
      <div className="flex gap-2">
        <input
          className="h-11 flex-1"
          inputMode="numeric"
          placeholder="Número da NF"
          value={numero}
          onChange={(e) => {
            setNumero(e.target.value);
            setErro('');
          }}
        />
        <button className="btn btn-primary h-11" disabled={salvando} onClick={salvar}>
          {salvando ? 'Salvando...' : 'Salvar NF'}
        </button>
      </div>
      {erro && <p className="mt-1 text-sm text-bad">{erro}</p>}
    </div>
  );
}
