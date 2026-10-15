'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adicionarNfAction, removerNfExtraAction } from './nfs-actions';

/** Lista as NFs do carregamento e deixa o Escritório adicionar outra (ou tirar uma extra). */
export function NfsPainel({
  movimentacaoId,
  principal,
  extras,
}: {
  movimentacaoId: string;
  principal: string | null;
  extras: string[];
}) {
  const router = useRouter();
  const [numero, setNumero] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function adicionar() {
    setErro('');
    setOcupado(true);
    const r = await adicionarNfAction(movimentacaoId, numero);
    setOcupado(false);
    if (!r.ok) {
      setErro(r.erro ?? 'Não foi possível salvar.');
      return;
    }
    setNumero('');
    router.refresh();
  }

  async function remover(nf: string) {
    setErro('');
    setOcupado(true);
    const r = await removerNfExtraAction(movimentacaoId, nf);
    setOcupado(false);
    if (!r.ok) {
      setErro(r.erro ?? 'Não foi possível remover.');
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-3">
      <p className="kv-label">Notas fiscais do carregamento</p>
      <ul className="mt-1 flex flex-wrap gap-2">
        {principal && (
          <li className="badge badge-ok font-mono" title="NF principal">
            {principal}
          </li>
        )}
        {extras.map((nf) => (
          <li key={nf} className="badge font-mono">
            {nf}
            <button
              type="button"
              className="ml-2 font-bold text-bad"
              aria-label={`Remover a NF ${nf}`}
              disabled={ocupado}
              onClick={() => remover(nf)}
            >
              ×
            </button>
          </li>
        ))}
        {!principal && extras.length === 0 && <li className="text-sm text-ink-muted">Nenhuma NF ainda.</li>}
      </ul>
      <div className="mt-2 flex gap-2">
        <input
          className="h-11 flex-1"
          inputMode="numeric"
          placeholder="Outra NF deste carregamento"
          value={numero}
          onChange={(e) => {
            setNumero(e.target.value);
            setErro('');
          }}
        />
        <button className="btn btn-ghost h-11" disabled={ocupado || numero.trim() === ''} onClick={adicionar}>
          {ocupado ? 'Salvando...' : 'Adicionar NF'}
        </button>
      </div>
      {erro && <p className="mt-1 text-sm text-bad">{erro}</p>}
    </div>
  );
}
