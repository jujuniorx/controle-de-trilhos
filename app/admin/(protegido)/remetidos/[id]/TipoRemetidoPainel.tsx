'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { informarTipoRemetidoAction } from './actions';

const OPCOES = [
  { value: 'VENDA', label: 'Venda' },
  { value: 'TRANS', label: 'Transferência' },
  { value: 'INDUS', label: 'Industrialização' },
] as const;

export function TipoRemetidoPainel({ movimentacaoId }: { movimentacaoId: string }) {
  const router = useRouter();
  const [tipo, setTipo] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setErro('');
    setSalvando(true);
    const resultado = await informarTipoRemetidoAction(movimentacaoId, tipo);
    setSalvando(false);
    if (!resultado.ok) {
      setErro(resultado.erro ?? 'Não foi possível salvar.');
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-3 rounded border p-3">
      <p className="mb-2 font-semibold text-amber-800">
        Tipo de remetido em aberto — o Pátio lançou direto, sem essa informação. Complete para liberar a conferência.
      </p>
      <div className="flex gap-2">
        <select
          className="h-11 flex-1 rounded border px-3"
          value={tipo}
          onChange={(e) => {
            setTipo(e.target.value);
            setErro('');
          }}
        >
          <option value="" disabled>
            Selecione
          </option>
          {OPCOES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          className="h-11 rounded bg-steel px-4 text-white disabled:bg-neutral-300"
          disabled={salvando}
          onClick={salvar}
        >
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
      {erro && <p className="mt-1 text-sm text-red-600">{erro}</p>}
    </div>
  );
}
