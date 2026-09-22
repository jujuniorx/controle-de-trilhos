'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { parseNumeroBR } from '@/lib/domain/regras';
import { informarPesoSucataAction, conferirRecebimentoAction } from './actions';

interface Props {
  movimentacaoId: string;
  status: 'PENDENTE_CONFERENCIA' | 'CONFERIDO';
  temSucata: boolean;
  pesoSucataReal: number | null;
}

export function ConferenciaPainel({ movimentacaoId, status, temSucata, pesoSucataReal }: Props) {
  const router = useRouter();
  const [pesoTexto, setPesoTexto] = useState(pesoSucataReal != null ? String(pesoSucataReal).replace('.', ',') : '');
  const [erroPeso, setErroPeso] = useState('');
  const [salvandoPeso, setSalvandoPeso] = useState(false);

  const [erroConferir, setErroConferir] = useState('');
  const [conferindo, setConferindo] = useState(false);

  const pesoPendente = temSucata && pesoSucataReal == null;
  const podeConferir = status === 'PENDENTE_CONFERENCIA' && !pesoPendente;

  async function salvarPeso() {
    setErroPeso('');
    const valor = parseNumeroBR(pesoTexto);
    if (valor == null) {
      setErroPeso('Informe um peso válido, maior que zero, ex.: 1,250.');
      return;
    }
    setSalvandoPeso(true);
    const resultado = await informarPesoSucataAction(movimentacaoId, valor);
    setSalvandoPeso(false);
    if (!resultado.ok) {
      setErroPeso(resultado.erro ?? 'Não foi possível salvar o peso.');
      return;
    }
    router.refresh();
  }

  async function conferir() {
    setErroConferir('');
    setConferindo(true);
    const resultado = await conferirRecebimentoAction(movimentacaoId);
    setConferindo(false);
    if (!resultado.ok) {
      setErroConferir(resultado.erro ?? 'Não foi possível conferir o recebimento.');
      return;
    }
    router.refresh();
  }

  return (
    <section className="rounded-lg border bg-white p-4">
      <h2 className="font-semibold text-neutral-800">Conferência</h2>

      <div className="mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium">
        {status === 'CONFERIDO' ? (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">CONFERIDO</span>
        ) : (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">PENDENTE DE CONFERÊNCIA</span>
        )}
      </div>

      {temSucata && (
        <div className="mt-3 rounded border p-3">
          {pesoPendente && (
            <p className="mb-2 font-semibold text-amber-800">
              Peso da sucata pendente. Informe o peso real antes de conferir o recebimento.
            </p>
          )}
          <label className="block text-sm font-medium text-neutral-700" htmlFor="peso-sucata">
            Peso real da sucata (t) — com base no documento de pesagem
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="peso-sucata"
              className="h-11 flex-1 rounded border px-3"
              inputMode="decimal"
              placeholder="Ex.: 1,250"
              value={pesoTexto}
              onChange={(e) => {
                setPesoTexto(e.target.value);
                setErroPeso('');
              }}
            />
            <button
              className="h-11 rounded bg-neutral-900 px-4 text-white disabled:bg-neutral-300"
              disabled={salvandoPeso}
              onClick={salvarPeso}
            >
              {salvandoPeso ? 'Salvando...' : pesoSucataReal != null ? 'Corrigir peso' : 'Salvar peso'}
            </button>
          </div>
          {erroPeso && <p className="mt-1 text-sm text-red-600">{erroPeso}</p>}
        </div>
      )}

      <div className="mt-3">
        <button
          className="h-12 w-full rounded bg-neutral-900 font-medium text-white disabled:bg-neutral-300"
          disabled={!podeConferir || conferindo}
          onClick={conferir}
        >
          {conferindo ? 'Conferindo...' : status === 'CONFERIDO' ? 'Recebimento conferido' : 'Conferir recebimento'}
        </button>
        {erroConferir && <p className="mt-1 text-sm text-red-600">{erroConferir}</p>}
      </div>
    </section>
  );
}
